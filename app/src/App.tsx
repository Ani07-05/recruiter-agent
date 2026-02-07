import { useState, useCallback, useEffect } from "react";
import { useWebSocket } from "./hooks/useWebSocket";
import { useVoiceCall } from "./hooks/useVoiceCall";
import { PreCallView } from "./components/PreCallView";
import { InCallView } from "./components/InCallView";
import { PostCallView } from "./components/PostCallView";
import { SuggestedQuestion, JobSummary, TranscriptLine, AppPhase } from "./types";
import { getApiUrl } from "./utils/api";

function App() {
  // Phase state
  const [phase, setPhase] = useState<AppPhase>("pre-call");

  // Core data
  const [suggestions, setSuggestions] = useState<SuggestedQuestion[]>([]);
  const [summary, setSummary] = useState<JobSummary | null>(null);
  const [transcriptLines, setTranscriptLines] = useState<TranscriptLine[]>([]);

  // Voice call state
  const [roomId, setRoomId] = useState<string>("");
  const [isVoiceCallActive, setIsVoiceCallActive] = useState(false);
  const [deepgramApiKey, setDeepgramApiKey] = useState<string>("");
  const [joinUrl, setJoinUrl] = useState<string>("");

  const handleSuggestion = useCallback((suggestion: SuggestedQuestion) => {
    setSuggestions((prev) => [suggestion, ...prev].slice(0, 10));
  }, []);

  const handleSummary = useCallback((newSummary: JobSummary) => {
    setSummary(newSummary);
    setPhase("post-call");
  }, []);

  const {
    connectionState,
    sendTranscript,
    endCall,
    clearSession,
    reconnect,
  } = useWebSocket({
    onSuggestion: handleSuggestion,
    onSummary: handleSummary,
  });

  // Fetch config on mount
  useEffect(() => {
    fetch(getApiUrl("/api/config"))
      .then((res) => res.json())
      .then((data) => {
        setDeepgramApiKey(data.deepgram_api_key || "");
      })
      .catch((err) => console.error("Failed to fetch config:", err));
  }, []);

  // Voice call transcript handler
  const handleVoiceTranscript = useCallback(
    (line: TranscriptLine) => {
      setTranscriptLines((prev) => {
        if (line.isFinal) {
          const interimIndex = prev.findIndex(
            (l) => l.speaker === line.speaker && !l.isFinal
          );
          if (interimIndex >= 0) {
            const updated = [...prev];
            updated[interimIndex] = line;
            return updated;
          }
          return [...prev, line];
        } else {
          const interimIndex = prev.findIndex(
            (l) => l.speaker === line.speaker && !l.isFinal
          );
          if (interimIndex >= 0) {
            const updated = [...prev];
            updated[interimIndex] = line;
            return updated;
          }
          return [...prev, line];
        }
      });

      if (line.isFinal && line.text.trim()) {
        sendTranscript(line.text, line.speaker);
      }
    },
    [sendTranscript]
  );

  // Voice call hook
  const voiceCall = useVoiceCall({
    roomId,
    role: "recruiter",
    onTranscript: handleVoiceTranscript,
    deepgramApiKey,
  });

  // Create room
  const handleCreateRoom = async () => {
    try {
      const response = await fetch(getApiUrl("/api/rooms"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      const newRoomId = data.room_id;

      const publicUrl =
        import.meta.env.VITE_PUBLIC_URL || window.location.origin;
      const url = `${publicUrl}${data.join_url}`;

      setRoomId(newRoomId);
      setJoinUrl(url);
      setIsVoiceCallActive(true);
    } catch (err) {
      console.error("Failed to create room:", err);
    }
  };

  // Start call when ready
  useEffect(() => {
    if (isVoiceCallActive && roomId && voiceCall.callState === "idle") {
      voiceCall.startCall();
    }
  }, [isVoiceCallActive, roomId, voiceCall]);

  // Transition to in-call phase
  useEffect(() => {
    if (isVoiceCallActive && phase === "pre-call") {
      setPhase("in-call");
    }
  }, [isVoiceCallActive, phase]);

  // End voice call
  const handleEndVoiceCall = () => {
    voiceCall.endCall();
    setIsVoiceCallActive(false);
    endCall();
    // Phase will transition to post-call when summary arrives (handleSummary)
    // Set post-call immediately as fallback (summary may arrive later)
    setPhase("post-call");
  };

  // Text mode send (pre-call)
  const handleSendTranscript = (text: string) => {
    sendTranscript(text, "hiring_manager");
  };

  // New session
  const handleNewSession = () => {
    clearSession();
    setSuggestions([]);
    setSummary(null);
    setRoomId("");
    setJoinUrl("");
    setIsVoiceCallActive(false);
    setTranscriptLines([]);
    setPhase("pre-call");
  };

  // Dismiss suggestion
  const handleDismissSuggestion = (index: number) => {
    setSuggestions((prev) => prev.filter((_, i) => i !== index));
  };

  // Copy join URL
  const handleCopyJoinUrl = () => {
    if (joinUrl) {
      navigator.clipboard.writeText(joinUrl);
    }
  };

  // Save transcript
  const handleSaveTranscript = useCallback(() => {
    const content = transcriptLines
      .filter((line) => line.isFinal)
      .map((line) => {
        const time = new Date(line.timestamp).toLocaleTimeString();
        const speaker =
          line.speaker === "recruiter" ? "Recruiter" : "Hiring Manager";
        return `[${time}] ${speaker}: ${line.text}`;
      })
      .join("\n\n");

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcript-${new Date().toISOString().split("T")[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [transcriptLines]);

  // Clear transcript
  const handleClearTranscript = useCallback(() => {
    if (confirm("Clear all transcript lines? This cannot be undone.")) {
      setTranscriptLines([]);
    }
  }, []);

  // Render based on phase
  switch (phase) {
    case "pre-call":
      return (
        <PreCallView
          connectionState={connectionState}
          joinUrl={joinUrl}
          onCreateRoom={handleCreateRoom}
          onSendTranscript={handleSendTranscript}
          onCopyJoinUrl={handleCopyJoinUrl}
          onReconnect={reconnect}
        />
      );

    case "in-call":
      return (
        <InCallView
          callState={voiceCall.callState}
          isMuted={voiceCall.isMuted}
          isRemoteConnected={voiceCall.isRemoteConnected}
          onToggleMute={voiceCall.toggleMute}
          onEndCall={handleEndVoiceCall}
          transcriptLines={transcriptLines}
          onSaveTranscript={handleSaveTranscript}
          onClearTranscript={handleClearTranscript}
          suggestions={suggestions}
          onDismissSuggestion={handleDismissSuggestion}
          connectionState={connectionState}
          joinUrl={joinUrl}
        />
      );

    case "post-call":
      return (
        <PostCallView
          summary={summary}
          transcriptLines={transcriptLines}
          onNewSession={handleNewSession}
        />
      );
  }
}

export default App;
