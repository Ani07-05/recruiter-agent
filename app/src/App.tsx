import { useState, useCallback, useEffect } from "react";
import { useWebSocket } from "./hooks/useWebSocket";
import { useVoiceCall } from "./hooks/useVoiceCall";
import { QuestionCard } from "./components/QuestionCard";
import { SummaryView } from "./components/SummaryView";
import { VoiceCallOverlay } from "./components/VoiceCallOverlay";
import { SuggestedQuestion, JobSummary, ConnectionState } from "./types";
import { getApiUrl } from "./utils/api";

function App() {
  const [suggestions, setSuggestions] = useState<SuggestedQuestion[]>([]);
  const [summary, setSummary] = useState<JobSummary | null>(null);
  const [transcript, setTranscript] = useState<string>("");
  const [inputText, setInputText] = useState("");
  
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

  // Voice call hook
  const handleVoiceTranscript = useCallback((text: string, speaker: string, isFinal: boolean) => {
    if (isFinal && text.trim()) {
      sendTranscript(text, speaker);
      setTranscript((prev) => prev + `\n[${speaker}]: ${text}`);
    }
  }, [sendTranscript]);

  const voiceCall = useVoiceCall({
    roomId,
    role: "recruiter",
    onTranscript: handleVoiceTranscript,
    deepgramApiKey,
  });

  // Create a new room
  const handleCreateRoom = async () => {
    try {
      const response = await fetch(getApiUrl("/api/rooms"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      setRoomId(data.room_id);
      
      // Use environment variable for public URL, fallback to window.location.origin
      const publicUrl = import.meta.env.VITE_PUBLIC_URL || window.location.origin;
      const url = `${publicUrl}${data.join_url}`;
      setJoinUrl(url);
      
      // Start the call immediately
      setIsVoiceCallActive(true);
      await voiceCall.startCall();
    } catch (err) {
      console.error("Failed to create room:", err);
    }
  };

  // End voice call
  const handleEndVoiceCall = () => {
    voiceCall.endCall();
    setIsVoiceCallActive(false);
    endCall(); // Also end the backend session
  };

  const handleSendTranscript = () => {
    if (inputText.trim()) {
      sendTranscript(inputText, "hiring_manager");
      setTranscript((prev) => prev + `\n[Hiring Manager]: ${inputText}`);
      setInputText("");
    }
  };

  const handleEndCall = () => {
    endCall();
  };

  const handleNewSession = () => {
    clearSession();
    setSuggestions([]);
    setSummary(null);
    setTranscript("");
    setRoomId("");
    setJoinUrl("");
    setIsVoiceCallActive(false);
  };

  const handleDismissSuggestion = (index: number) => {
    setSuggestions((prev) => prev.filter((_, i) => i !== index));
  };

  // Copy join URL to clipboard
  const handleCopyJoinUrl = () => {
    if (joinUrl) {
      navigator.clipboard.writeText(joinUrl);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)]">
      {/* Header */}
      <header className="bg-white border-b border-[var(--border-color)] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[var(--accent)] rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h1 className="text-lg font-semibold text-[var(--text-primary)]">Recruiter Assistant</h1>
          </div>
          <div className="flex items-center gap-4">
            <ConnectionStatus state={connectionState} onReconnect={reconnect} />
            
            {!isVoiceCallActive && !joinUrl && (
              <button
                onClick={handleCreateRoom}
                className="px-4 py-1.5 text-sm bg-[var(--accent)] text-white rounded-md hover:bg-[var(--accent-hover)] transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                Start Voice Call
              </button>
            )}
            
            {joinUrl && !isVoiceCallActive && (
              <button
                onClick={handleCopyJoinUrl}
                className="px-4 py-1.5 text-sm bg-[var(--success)] text-white rounded-md hover:bg-green-700 transition-colors flex items-center gap-2"
                title="Copy link to share with hiring manager"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy Join Link
              </button>
            )}
            
            <button
              onClick={handleNewSession}
              className="px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-md transition-colors"
            >
              New Session
            </button>
            
            {!isVoiceCallActive && (
              <button
                onClick={handleEndCall}
                className="px-4 py-1.5 text-sm bg-[var(--accent)] text-white rounded-md hover:bg-[var(--accent-hover)] transition-colors"
              >
                End Call & Summarize
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-6">
        {/* Join URL Banner */}
        {joinUrl && (
          <div className="mb-6 bg-gradient-to-r from-[var(--accent)] to-[var(--accent-hover)] rounded-lg p-4 text-white animate-fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold">Room Created - Share this link</p>
                  <p className="text-sm text-white/90 font-mono mt-1">{joinUrl}</p>
                </div>
              </div>
              <button
                onClick={handleCopyJoinUrl}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-md text-sm font-medium transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy Link
              </button>
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Transcript Input */}
          <div className="lg:col-span-2 space-y-4">
            {/* Transcript Display */}
            <div className="bg-white rounded-lg border border-[var(--border-color)] p-4">
              <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-3">Conversation Transcript</h2>
              <div className="h-64 overflow-y-auto bg-[var(--bg-secondary)] rounded-md p-3 font-mono text-sm whitespace-pre-wrap text-[var(--text-primary)]">
                {transcript || <span className="text-[var(--text-muted)]">Transcript will appear here...</span>}
              </div>
            </div>

            {/* Input Area */}
            <div className="bg-white rounded-lg border border-[var(--border-color)] p-4">
              <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-3">Simulate Transcript Input</h2>
              <p className="text-xs text-[var(--text-muted)] mb-3">
                Enter what the hiring manager says to test the assistant
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendTranscript()}
                  placeholder="Type what the hiring manager says..."
                  className="flex-1 px-3 py-2 border border-[var(--border-color)] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                />
                <button
                  onClick={handleSendTranscript}
                  disabled={!inputText.trim() || connectionState !== "connected"}
                  className="px-4 py-2 bg-[var(--accent)] text-white text-sm rounded-md hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Send
                </button>
              </div>
            </div>

            {/* Summary Section */}
            {summary && (
              <div className="animate-fade-in">
                <SummaryView summary={summary} onClose={() => setSummary(null)} />
              </div>
            )}
          </div>

          {/* Right: Suggestions Panel */}
          <div className="space-y-4">
            <div className="bg-white rounded-lg border border-[var(--border-color)] p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium text-[var(--text-secondary)]">Suggested Questions</h2>
                <span className="text-xs text-[var(--text-muted)]">{suggestions.length} suggestions</span>
              </div>

              {suggestions.length > 0 ? (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {suggestions.map((suggestion, index) => (
                    <QuestionCard
                      key={`${suggestion.question}-${index}`}
                      question={suggestion}
                      isNew={index === 0}
                      onDismiss={() => handleDismissSuggestion(index)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-[var(--text-muted)]">
                  <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm">No suggestions yet</p>
                  <p className="text-xs mt-1">Questions will appear as you add transcript</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Voice Call Overlay */}
      {isVoiceCallActive && (
        <VoiceCallOverlay
          callState={voiceCall.callState}
          isMuted={voiceCall.isMuted}
          isRemoteConnected={voiceCall.isRemoteConnected}
          onToggleMute={voiceCall.toggleMute}
          onEndCall={handleEndVoiceCall}
          participantName="Hiring Manager"
        />
      )}
    </div>
  );
}

function ConnectionStatus({ state, onReconnect }: { state: ConnectionState; onReconnect: () => void }) {
  const statusConfig = {
    connected: { color: "bg-[var(--success)]", text: "Connected" },
    connecting: { color: "bg-[var(--warning)] animate-pulse", text: "Connecting..." },
    disconnected: { color: "bg-[var(--text-muted)]", text: "Disconnected" },
    error: { color: "bg-[var(--error)]", text: "Error" },
  };

  const config = statusConfig[state];

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${config.color}`} />
      <span className="text-sm text-[var(--text-secondary)]">{config.text}</span>
      {(state === "error" || state === "disconnected") && (
        <button
          onClick={onReconnect}
          className="text-xs text-[var(--accent)] hover:underline"
        >
          Reconnect
        </button>
      )}
    </div>
  );
}

export default App;
