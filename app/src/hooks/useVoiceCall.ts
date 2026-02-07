import { useCallback, useEffect, useRef, useState } from "react";
import { TranscriptLine } from "../types";

export type CallState = "idle" | "connecting" | "connected" | "error";
export type ParticipantRole = "recruiter" | "hiring_manager";

interface UseVoiceCallOptions {
  roomId: string;
  role: ParticipantRole;
  onTranscript: (line: TranscriptLine) => void;
  deepgramApiKey: string;
}

interface UseVoiceCallReturn {
  callState: CallState;
  isMuted: boolean;
  isRemoteConnected: boolean;
  startCall: () => Promise<void>;
  endCall: () => void;
  toggleMute: () => void;
  error: string | null;
}

export function useVoiceCall({
  roomId,
  role,
  onTranscript,
  deepgramApiKey,
}: UseVoiceCallOptions): UseVoiceCallReturn {
  const [callState, setCallState] = useState<CallState>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [isRemoteConnected, setIsRemoteConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const signalingWsRef = useRef<WebSocket | null>(null);
  const deepgramWsRef = useRef<WebSocket | null>(null);
  const remoteDeepgramWsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const remoteAudioContextRef = useRef<AudioContext | null>(null);
  const remoteProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const remoteDescriptionSetRef = useRef<boolean>(false);
  const signalingQueueRef = useRef<Promise<void>>(Promise.resolve());
  const onTranscriptRef = useRef(onTranscript);
  const roleRef = useRef(role);
  const deepgramApiKeyRef = useRef(deepgramApiKey);
  const isMutedRef = useRef(isMuted);

  // Keep refs in sync so closures inside createPeerConnection/ontrack stay current
  onTranscriptRef.current = onTranscript;
  roleRef.current = role;
  deepgramApiKeyRef.current = deepgramApiKey;
  isMutedRef.current = isMuted;

  const connectToDeepgram = useCallback((): Promise<WebSocket> => {
    const apiKey = deepgramApiKeyRef.current;
    if (!apiKey) {
      console.error("[Transcript] No Deepgram API key — check /api/config response");
      return Promise.reject(new Error("No Deepgram API key"));
    }

    console.log("[Transcript] Connecting to Deepgram with key:", apiKey.substring(0, 8) + "...");

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(
        `wss://api.deepgram.com/v1/listen?model=nova-2&punctuate=true&interim_results=true&encoding=linear16&sample_rate=16000&smart_format=true&language=en`,
        ["token", apiKey]
      );

      ws.onopen = () => {
        console.log("[Transcript] Deepgram local connected");
        deepgramWsRef.current = ws;
        resolve(ws);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.channel?.alternatives?.[0]?.transcript) {
            const transcript = data.channel.alternatives[0].transcript;
            const isFinal = data.is_final;
            if (transcript) {
              const currentRole = roleRef.current;
              const words = transcript.split(' ').map((word: string, idx: number) => ({
                word,
                startTime: Date.now() + (idx * 50),
                isInterim: !isFinal,
              }));

              const line: TranscriptLine = {
                id: `${currentRole}-${Date.now()}-${Math.random()}`,
                speaker: currentRole,
                words,
                text: transcript,
                timestamp: Date.now(),
                isFinal,
              };

              onTranscriptRef.current(line);
            }
          }
        } catch (e) {
          console.error("[Transcript] Error parsing Deepgram message:", e);
        }
      };

      ws.onerror = (e) => {
        console.error("[Transcript] Deepgram WebSocket error:", e);
        reject(e);
      };

      ws.onclose = (event) => {
        console.log("[Transcript] Deepgram local closed:", event.code, event.reason);
      };
    });
  }, []);

  const startAudioProcessing = useCallback(async (stream: MediaStream) => {
    if (!deepgramWsRef.current) {
      console.error("[Transcript] Cannot start audio processing — no Deepgram connection");
      return;
    }

    const clonedStream = stream.clone();

    const audioContext = new AudioContext({ sampleRate: 16000 });
    // Chrome suspends AudioContext unless created during user gesture — must resume
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }
    console.log("[Transcript] Local AudioContext state:", audioContext.state);

    const source = audioContext.createMediaStreamSource(clonedStream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = (e) => {
      if (deepgramWsRef.current?.readyState === WebSocket.OPEN && !isMutedRef.current) {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcmData[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
        }
        deepgramWsRef.current.send(pcmData.buffer);
      }
    };

    source.connect(processor);
    const gainNode = audioContext.createGain();
    gainNode.gain.value = 0;
    processor.connect(gainNode);
    gainNode.connect(audioContext.destination);

    audioContextRef.current = audioContext;
    processorRef.current = processor;
    console.log("[Transcript] Local audio processing started");
  }, []);

  const startRemoteAudioTranscription = useCallback(async (stream: MediaStream) => {
    const apiKey = deepgramApiKeyRef.current;
    if (!apiKey) {
      console.error("[Transcript] No Deepgram API key for remote audio");
      return;
    }

    const remoteRole = roleRef.current === "recruiter" ? "hiring_manager" : "recruiter";
    console.log("[Transcript] Starting remote audio transcription as:", remoteRole);

    // Create AudioContext first and resume it (must happen before WS connects)
    const audioContext = new AudioContext({ sampleRate: 16000 });
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }
    console.log("[Transcript] Remote AudioContext state:", audioContext.state);

    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);

    const ws = new WebSocket(
      `wss://api.deepgram.com/v1/listen?model=nova-2&punctuate=true&interim_results=true&encoding=linear16&sample_rate=16000&smart_format=true&language=en`,
      ["token", apiKey]
    );

    ws.onopen = () => {
      console.log("[Transcript] Deepgram remote connected");

      processor.onaudioprocess = (e) => {
        if (ws.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0);
          const pcmData = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            pcmData[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
          }
          ws.send(pcmData.buffer);
        }
      };

      source.connect(processor);
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 0;
      processor.connect(gainNode);
      gainNode.connect(audioContext.destination);

      remoteAudioContextRef.current = audioContext;
      remoteProcessorRef.current = processor;
      console.log("[Transcript] Remote audio processing started");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.channel?.alternatives?.[0]?.transcript) {
          const transcript = data.channel.alternatives[0].transcript;
          const isFinal = data.is_final;
          if (transcript) {
            const words = transcript.split(' ').map((word: string, idx: number) => ({
              word,
              startTime: Date.now() + (idx * 50),
              isInterim: !isFinal,
            }));

            const line: TranscriptLine = {
              id: `${remoteRole}-${Date.now()}-${Math.random()}`,
              speaker: remoteRole as ParticipantRole,
              words,
              text: transcript,
              timestamp: Date.now(),
              isFinal,
            };

            onTranscriptRef.current(line);
          }
        }
      } catch (e) {
        console.error("[Transcript] Error parsing remote Deepgram message:", e);
      }
    };

    ws.onerror = (e) => console.error("[Transcript] Remote Deepgram error:", e);
    ws.onclose = (event) => console.log("[Transcript] Remote Deepgram closed:", event.code, event.reason);

    remoteDeepgramWsRef.current = ws;
  }, []);

  const startCall = useCallback(async () => {
    setCallState("connecting");
    setError(null);

    try {
      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Your browser doesn't support audio capture. Please use Chrome, Firefox, or Safari with HTTPS.");
      }

      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          // Don't force sample rate - let browser use optimal rate for WebRTC
        },
        video: false,
      });
      localStreamRef.current = stream;
      
      // Ensure audio track is enabled
      stream.getAudioTracks().forEach(track => {
        track.enabled = true;
        console.log("Local audio track:", track.label, "enabled:", track.enabled);
      });

      // Connect to Deepgram for transcription, then start processing
      connectToDeepgram()
        .then(() => startAudioProcessing(stream))
        .catch((e) => console.error("[Transcript] Deepgram setup failed:", e));

      // Connect to signaling server
      // If VITE_API_URL is set (ngrok), use it directly
      let signalingUrl: string;
      if (import.meta.env.VITE_API_URL) {
        const apiUrl = import.meta.env.VITE_API_URL;
        const wsProtocol = apiUrl.startsWith("https") ? "wss:" : "ws:";
        const cleanUrl = apiUrl.replace(/^https?:\/\//, "");
        signalingUrl = `${wsProtocol}//${cleanUrl}/call/${roomId}`;
      } else {
        // Use proxy (local dev)
        const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        signalingUrl = `${wsProtocol}//${window.location.host}/call/${roomId}`;
      }
      
      const ws = new WebSocket(signalingUrl);

      ws.onopen = () => {
        console.log("Connected to signaling server");
        ws.send(JSON.stringify({ type: "join", role }));
      };

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        console.log("Signaling message received:", message.type);

        // Serialize message processing to prevent race conditions
        signalingQueueRef.current = signalingQueueRef.current.then(async () => {
          switch (message.type) {
            case "peer_joined":
              console.log("Peer joined, setting remote connected");
              setIsRemoteConnected(true);
              if (role === "recruiter") {
                console.log("Creating offer as recruiter");
                await createOffer(ws);
              }
              break;

            case "peer_left":
              console.log("Peer left");
              setIsRemoteConnected(false);
              break;

            case "offer":
              console.log("Received offer, creating answer");
              await handleOffer(ws, message.sdp);
              break;

            case "answer":
              console.log("Received answer, setting remote description");
              await handleAnswer(message.sdp);
              break;

            case "ice_candidate":
              await handleIceCandidate(message.candidate);
              break;

            case "error":
              console.error("Signaling error:", message.message);
              setError(message.message);
              break;
          }
        }).catch((e) => {
          console.error("Error processing signaling message:", e);
        });
      };

      ws.onerror = () => {
        setError("Signaling connection failed");
        setCallState("error");
      };

      ws.onclose = () => {
        console.log("Signaling connection closed");
      };

      signalingWsRef.current = ws;
      setCallState("connected");
    } catch (e) {
      console.error("Failed to start call:", e);
      setError(e instanceof Error ? e.message : "Failed to start call");
      setCallState("error");
    }
  }, [roomId, role, connectToDeepgram, startAudioProcessing]);

  const createPeerConnection = useCallback(() => {
    // For production, use a paid TURN service (e.g., Twilio, Cloudflare Calls, Metered).
    // STUN-only works when at least one peer has a public IP or cone NAT.
    // TURN is required when both peers are behind symmetric NAT.
    const iceServers: RTCIceServer[] = [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun.cloudflare.com:3478" },
    ];

    // Add TURN servers from env if configured (format: url|username|credential)
    const turnConfig = import.meta.env.VITE_TURN_SERVER_URL;
    if (turnConfig) {
      iceServers.push({
        urls: import.meta.env.VITE_TURN_SERVER_URL,
        username: import.meta.env.VITE_TURN_SERVER_USERNAME || "",
        credential: import.meta.env.VITE_TURN_SERVER_CREDENTIAL || "",
      });
    } else {
      // Fallback free TURN servers (unreliable — configure VITE_TURN_SERVER_* for production)
      iceServers.push(
        {
          urls: [
            "turn:openrelay.metered.ca:80",
            "turn:openrelay.metered.ca:443",
            "turn:openrelay.metered.ca:443?transport=tcp",
          ],
          username: "openrelayproject",
          credential: "openrelayproject",
        },
      );
    }

    const pc = new RTCPeerConnection({
      iceServers,
      iceCandidatePoolSize: 10,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      iceTransportPolicy: 'all',
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const cand = event.candidate;
        console.log(`✅ ICE candidate: ${cand.type} ${cand.protocol} ${cand.address || ''}`, 
          cand.type === 'relay' ? '🔥 TURN RELAY WORKING!' : '');
        if (signalingWsRef.current?.readyState === WebSocket.OPEN) {
          signalingWsRef.current.send(
            JSON.stringify({ type: "ice_candidate", candidate: event.candidate })
          );
        }
      } else {
        console.log("✅ ICE gathering completed");
      }
    };

    pc.onicegatheringstatechange = () => {
      console.log("ICE gathering state:", pc.iceGatheringState);
    };

    pc.oniceconnectionstatechange = () => {
      console.log("ICE connection state:", pc.iceConnectionState);
      if (pc.iceConnectionState === 'connected') {
        console.log("ICE connection established successfully");
      } else if (pc.iceConnectionState === 'failed') {
        console.error("ICE connection failed - trying to restart ICE");
        // Try to restart ICE
        pc.restartIce();
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("Connection state:", pc.connectionState);
      if (pc.connectionState === 'connected') {
        console.log("Peer connection established successfully");
      } else if (pc.connectionState === 'failed') {
        console.error("Peer connection failed");
      }
    };

    pc.ontrack = (event) => {
      console.log("Received remote track:", event.track.kind, event.track.enabled, "readyState:", event.track.readyState);
      
      const stream = event.streams[0];
      console.log("Remote stream info:", {
        id: stream.id,
        active: stream.active,
        audioTracks: stream.getAudioTracks().length,
      });
      
      // Log audio track details
      stream.getAudioTracks().forEach((track, idx) => {
        console.log(`Remote audio track ${idx}:`, {
          id: track.id,
          label: track.label,
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState,
        });
      });
      
      // Create or reuse audio element and attach to DOM
      if (!remoteAudioRef.current) {
        remoteAudioRef.current = new Audio();
        remoteAudioRef.current.autoplay = true;
        remoteAudioRef.current.volume = 1.0;
        remoteAudioRef.current.muted = false;
        remoteAudioRef.current.id = 'remote-audio-element';
        // Attach to DOM - some browsers require this
        document.body.appendChild(remoteAudioRef.current);
        console.log("Audio element attached to DOM");
      }
      
      remoteAudioRef.current.srcObject = stream;
      
      console.log("Remote audio element setup:", {
        srcObject: remoteAudioRef.current.srcObject,
        volume: remoteAudioRef.current.volume,
        muted: remoteAudioRef.current.muted,
        paused: remoteAudioRef.current.paused,
      });
      
      // Force play
      remoteAudioRef.current.play()
        .then(() => {
          console.log("Remote audio playing successfully");
        })
        .catch((err) => {
          console.error("Failed to play remote audio:", err);
          document.addEventListener('click', () => {
            remoteAudioRef.current?.play().catch(console.error);
          }, { once: true });
        });

      // Transcribe remote audio
      startRemoteAudioTranscription(stream);
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        console.log("Adding local track:", track.kind, track.enabled);
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    peerConnectionRef.current = pc;
    return pc;
  }, [startRemoteAudioTranscription]);

  const createOffer = useCallback(async (ws: WebSocket) => {
    console.log("Creating peer connection and offer");
    const pc = createPeerConnection();
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    console.log("Sending offer to peer");
    ws.send(JSON.stringify({ type: "offer", sdp: offer }));
  }, [createPeerConnection]);

  const flushIceCandidates = useCallback(async () => {
    const pc = peerConnectionRef.current;
    if (!pc || !remoteDescriptionSetRef.current) return;
    const candidates = pendingIceCandidatesRef.current.splice(0);
    for (const candidate of candidates) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
        console.log("Flushed buffered ICE candidate");
      } catch (e) {
        console.error("Failed to add buffered ICE candidate:", e);
      }
    }
  }, []);

  const handleOffer = useCallback(async (ws: WebSocket, sdp: RTCSessionDescriptionInit) => {
    console.log("Handling offer, creating peer connection");
    const pc = createPeerConnection();
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    remoteDescriptionSetRef.current = true;
    await flushIceCandidates();
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    console.log("Sending answer to peer");
    ws.send(JSON.stringify({ type: "answer", sdp: answer }));
  }, [createPeerConnection, flushIceCandidates]);

  const handleAnswer = useCallback(async (sdp: RTCSessionDescriptionInit) => {
    console.log("Setting remote description from answer");
    if (peerConnectionRef.current) {
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
      remoteDescriptionSetRef.current = true;
      await flushIceCandidates();
      console.log("Remote description set successfully");
    } else {
      console.error("No peer connection available to set answer");
    }
  }, [flushIceCandidates]);

  const handleIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    if (peerConnectionRef.current && remoteDescriptionSetRef.current) {
      try {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        console.log("ICE candidate added successfully");
      } catch (e) {
        console.error("Failed to add ICE candidate:", e);
      }
    } else {
      console.log("Buffering ICE candidate (peer connection not ready)");
      pendingIceCandidatesRef.current.push(candidate);
    }
  }, []);

  const endCall = useCallback(() => {
    // Close Deepgram connections
    if (deepgramWsRef.current) {
      deepgramWsRef.current.close();
      deepgramWsRef.current = null;
    }
    if (remoteDeepgramWsRef.current) {
      remoteDeepgramWsRef.current.close();
      remoteDeepgramWsRef.current = null;
    }

    // Close audio processing (local)
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Close audio processing (remote)
    if (remoteProcessorRef.current) {
      remoteProcessorRef.current.disconnect();
      remoteProcessorRef.current = null;
    }
    if (remoteAudioContextRef.current) {
      remoteAudioContextRef.current.close();
      remoteAudioContextRef.current = null;
    }

    // Stop and cleanup remote audio
    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current.srcObject = null;
      // Remove from DOM if attached
      if (remoteAudioRef.current.parentNode) {
        remoteAudioRef.current.parentNode.removeChild(remoteAudioRef.current);
      }
      remoteAudioRef.current = null;
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Close signaling connection
    if (signalingWsRef.current) {
      signalingWsRef.current.close();
      signalingWsRef.current = null;
    }

    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    // Reset ICE candidate buffering state
    pendingIceCandidatesRef.current = [];
    remoteDescriptionSetRef.current = false;
    signalingQueueRef.current = Promise.resolve();

    setCallState("idle");
    setIsRemoteConnected(false);
  }, []);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted((prev) => !prev);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      endCall();
    };
  }, [endCall]);

  return {
    callState,
    isMuted,
    isRemoteConnected,
    startCall,
    endCall,
    toggleMute,
    error,
  };
}
