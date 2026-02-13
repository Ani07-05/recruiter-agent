import { useState, useCallback, useEffect } from "react";
import { useWebSocket } from "./hooks/useWebSocket";
import { useVoiceCall } from "./hooks/useVoiceCall";
import { PreCallView } from "./components/PreCallView";
import { InCallView } from "./components/InCallView";
import { PostCallView } from "./components/PostCallView";
import { CompletionChecklistModal } from "./components/CompletionChecklistModal";
import { SuggestedQuestion, JobSummary, TranscriptLine, AppPhase, AgentState, CompletionStatus } from "./types";
import { getApiUrl } from "./utils/api";

function App() {
  // Phase state
  const [phase, setPhase] = useState<AppPhase>("pre-call");

  // Core data — single question at a time
  const [currentSuggestion, setCurrentSuggestion] = useState<SuggestedQuestion | null>(null);
  const [pastSuggestions, setPastSuggestions] = useState<SuggestedQuestion[]>([]);
  const [summary, setSummary] = useState<JobSummary | null>(null);
  const [transcriptLines, setTranscriptLines] = useState<TranscriptLine[]>([]);

  // Agent state
  const [agentState, setAgentState] = useState<AgentState>("listening");

  // Voice call state
  const [roomId, setRoomId] = useState<string>("");
  const [isVoiceCallActive, setIsVoiceCallActive] = useState(false);
  const [deepgramApiKey, setDeepgramApiKey] = useState<string>("");
  const [joinUrl, setJoinUrl] = useState<string>("");

  // Completion status modal
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completionStatus, setCompletionStatus] = useState<CompletionStatus | null>(null);

  const handleSuggestion = useCallback((suggestion: SuggestedQuestion) => {
    setCurrentSuggestion((prev) => {
      // Push old question to history
      if (prev) {
        setPastSuggestions((past) => [prev, ...past].slice(0, 20));
      }
      return suggestion;
    });
  }, []);

  const handleSummary = useCallback((newSummary: JobSummary) => {
    setSummary(newSummary);
    setPhase("post-call");
  }, []);

  const handleStateChange = useCallback((state: AgentState) => {
    setAgentState(state);
  }, []);

  const handleCompletionStatus = useCallback((status: CompletionStatus) => {
    setCompletionStatus(status);
    setShowCompletionModal(true);
  }, []);

  const {
    connectionState,
    sendTranscript,
    sendQuestionShown,
    endCall,
    clearSession,
    reconnect,
    generateQuestion,
    getCompletionStatus,
  } = useWebSocket({
    onSuggestion: handleSuggestion,
    onSummary: handleSummary,
    onStateChange: handleStateChange,
    onCompletionStatus: handleCompletionStatus,
  });

  // Notify backend when a new question is displayed
  useEffect(() => {
    if (currentSuggestion) {
      sendQuestionShown();
    }
  }, [currentSuggestion, sendQuestionShown]);

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
        console.log(`[Agent] Sending transcript to backend: [${line.speaker}] ${line.text}`);
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

  // Request to end voice call - check completion status first
  const handleEndVoiceCallRequest = () => {
    getCompletionStatus();
  };

  // Actually end the voice call (after modal confirmation)
  const handleEndVoiceCall = () => {
    setShowCompletionModal(false);
    voiceCall.endCall();
    setIsVoiceCallActive(false);
    endCall();
    // Phase will transition to post-call when summary arrives (handleSummary)
    // Set post-call immediately as fallback (summary may arrive later)
    setPhase("post-call");
  };

  // Handle continue from modal
  const handleContinueCall = () => {
    setShowCompletionModal(false);
  };

  // Text mode send (pre-call)
  const handleSendTranscript = (text: string) => {
    sendTranscript(text, "hiring_manager");
  };

  // New session
  const handleNewSession = () => {
    clearSession();
    setCurrentSuggestion(null);
    setPastSuggestions([]);
    setSummary(null);
    setRoomId("");
    setJoinUrl("");
    setIsVoiceCallActive(false);
    setTranscriptLines([]);
    setAgentState("listening");
    setPhase("pre-call");
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
        <>
          <InCallView
            callState={voiceCall.callState}
            isMuted={voiceCall.isMuted}
            isRemoteConnected={voiceCall.isRemoteConnected}
            onToggleMute={voiceCall.toggleMute}
            onEndCall={handleEndVoiceCallRequest}
            transcriptLines={transcriptLines}
            onSaveTranscript={handleSaveTranscript}
            onClearTranscript={handleClearTranscript}
            currentSuggestion={currentSuggestion}
            pastSuggestions={pastSuggestions}
            agentState={agentState}
            connectionState={connectionState}
            joinUrl={joinUrl}
            onGenerateQuestion={generateQuestion}
          />
          <CompletionChecklistModal
            isOpen={showCompletionModal}
            status={completionStatus}
            onContinue={handleContinueCall}
            onEndCall={handleEndVoiceCall}
          />
        </>
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
