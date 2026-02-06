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
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  const connectToDeepgram = useCallback(async () => {
    if (!deepgramApiKey) {
      console.warn("No Deepgram API key provided");
      return;
    }

    console.log("Connecting to Deepgram with key:", deepgramApiKey.substring(0, 10) + "...");

    try {
      const ws = new WebSocket(
        `wss://api.deepgram.com/v1/listen?model=nova-2&punctuate=true&diarize=true&interim_results=true`,
        ["token", deepgramApiKey]
      );

      ws.onopen = () => {
        console.log("Connected to Deepgram");
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("Deepgram message:", data);
          if (data.channel?.alternatives?.[0]?.transcript) {
            const transcript = data.channel.alternatives[0].transcript;
            const isFinal = data.is_final;
            if (transcript) {
              // Split into words for animation
              const words = transcript.split(' ').map((word: string, idx: number) => ({
                word,
                startTime: Date.now() + (idx * 50),
                isInterim: !isFinal,
              }));
              
              const line: TranscriptLine = {
                id: `${role}-${Date.now()}-${Math.random()}`,
                speaker: role,
                words,
                text: transcript,
                timestamp: Date.now(),
                isFinal,
              };
              
              onTranscript(line);
            }
          }
        } catch (e) {
          console.error("Error parsing Deepgram message:", e);
        }
      };

      ws.onerror = (e) => {
        console.error("Deepgram error:", e);
      };

      ws.onclose = (event) => {
        console.log("Deepgram connection closed:", event.code, event.reason);
      };

      deepgramWsRef.current = ws;
    } catch (e) {
      console.error("Failed to connect to Deepgram:", e);
    }
  }, [deepgramApiKey, onTranscript, role]);

  const startAudioProcessing = useCallback((stream: MediaStream) => {
    if (!deepgramWsRef.current) return;

    // Clone the stream for transcription processing to avoid interference with WebRTC
    const clonedStream = stream.clone();
    
    const audioContext = new AudioContext({ sampleRate: 16000 });
    const source = audioContext.createMediaStreamSource(clonedStream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = (e) => {
      if (deepgramWsRef.current?.readyState === WebSocket.OPEN && !isMuted) {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcmData[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
        }
        deepgramWsRef.current.send(pcmData.buffer);
      }
    };

    source.connect(processor);
    // Connect to a dummy destination to keep processor running without audio feedback
    const gainNode = audioContext.createGain();
    gainNode.gain.value = 0; // Mute the output
    processor.connect(gainNode);
    gainNode.connect(audioContext.destination);

    audioContextRef.current = audioContext;
    processorRef.current = processor;
  }, [isMuted]);

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

      // Connect to Deepgram for transcription
      await connectToDeepgram();

      // Start audio processing for transcription
      setTimeout(() => startAudioProcessing(stream), 1000);

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

      ws.onmessage = async (event) => {
        const message = JSON.parse(event.data);
        console.log("Signaling message received:", message.type);

        switch (message.type) {
          case "peer_joined":
            console.log("Peer joined, setting remote connected");
            setIsRemoteConnected(true);
            // If we're the recruiter, create offer
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
            console.log("Received ICE candidate");
            await handleIceCandidate(message.candidate);
            break;

          case "error":
            console.error("Signaling error:", message.message);
            setError(message.message);
            break;
        }
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
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        // Metered TURN servers (free tier)
        {
          urls: "turn:a.relay.metered.ca:80",
          username: "87e89ea6d2d873b487ad",
          credential: "yNhFF7zWwfK3AWHz",
        },
        {
          urls: "turn:a.relay.metered.ca:80?transport=tcp",
          username: "87e89ea6d2d873b487ad",
          credential: "yNhFF7zWwfK3AWHz",
        },
        {
          urls: "turn:a.relay.metered.ca:443",
          username: "87e89ea6d2d873b487ad",
          credential: "yNhFF7zWwfK3AWHz",
        },
        {
          urls: "turns:a.relay.metered.ca:443?transport=tcp",
          username: "87e89ea6d2d873b487ad",
          credential: "yNhFF7zWwfK3AWHz",
        },
      ],
      iceCandidatePoolSize: 10,
      iceTransportPolicy: 'all',
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("Sending ICE candidate:", event.candidate.type, event.candidate.protocol);
        if (signalingWsRef.current?.readyState === WebSocket.OPEN) {
          signalingWsRef.current.send(
            JSON.stringify({ type: "ice_candidate", candidate: event.candidate })
          );
        }
      } else {
        console.log("ICE gathering completed");
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
      
      remoteAudioRef.current.srcObject = event.streams[0];
      
      console.log("Remote audio element setup:", {
        srcObject: remoteAudioRef.current.srcObject,
        volume: remoteAudioRef.current.volume,
        muted: remoteAudioRef.current.muted,
        paused: remoteAudioRef.current.paused,
      });
      
      // Handle autoplay promise
      remoteAudioRef.current.play()
        .then(() => {
          console.log("Remote audio playing successfully");
        })
        .catch((err) => {
          console.error("Failed to play remote audio:", err);
          // Try again after user interaction
          document.addEventListener('click', () => {
            console.log("Attempting to play remote audio after user interaction");
            remoteAudioRef.current?.play().catch(console.error);
          }, { once: true });
        });
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        console.log("Adding local track:", track.kind, track.enabled);
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    peerConnectionRef.current = pc;
    return pc;
  }, []);

  const createOffer = useCallback(async (ws: WebSocket) => {
    console.log("Creating peer connection and offer");
    const pc = createPeerConnection();
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    console.log("Sending offer to peer");
    ws.send(JSON.stringify({ type: "offer", sdp: offer }));
  }, [createPeerConnection]);

  const handleOffer = useCallback(async (ws: WebSocket, sdp: RTCSessionDescriptionInit) => {
    console.log("Handling offer, creating peer connection");
    const pc = createPeerConnection();
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    console.log("Sending answer to peer");
    ws.send(JSON.stringify({ type: "answer", sdp: answer }));
  }, [createPeerConnection]);

  const handleAnswer = useCallback(async (sdp: RTCSessionDescriptionInit) => {
    console.log("Setting remote description from answer");
    if (peerConnectionRef.current) {
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
      console.log("Remote description set successfully");
    } else {
      console.error("No peer connection available to set answer");
    }
  }, []);

  const handleIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    console.log("Adding ICE candidate from remote peer");
    if (peerConnectionRef.current) {
      await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      console.log("ICE candidate added successfully");
    } else {
      console.error("No peer connection available to add ICE candidate");
    }
  }, []);

  const endCall = useCallback(() => {
    // Close Deepgram connection
    if (deepgramWsRef.current) {
      deepgramWsRef.current.close();
      deepgramWsRef.current = null;
    }

    // Close audio processing
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
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
