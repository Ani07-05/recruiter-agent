import { useState } from "react";
import { ConnectionState } from "../types";

interface PreCallViewProps {
  connectionState: ConnectionState;
  joinUrl: string;
  onCreateRoom: () => void;
  onSendTranscript: (text: string) => void;
  onCopyJoinUrl: () => void;
  onReconnect: () => void;
}

export function PreCallView({
  connectionState,
  joinUrl,
  onCreateRoom,
  onSendTranscript,
  onCopyJoinUrl,
  onReconnect,
}: PreCallViewProps) {
  const [inputText, setInputText] = useState("");
  const [showTextMode, setShowTextMode] = useState(false);

  const handleSend = () => {
    if (inputText.trim()) {
      onSendTranscript(inputText.trim());
      setInputText("");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 animate-phase-in">
      <div className="max-w-lg w-full">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-[var(--accent)] rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h1 className="text-display text-[var(--text-primary)] mb-2">Recruiter Assistant</h1>
          <p className="text-[var(--text-secondary)]">
            Start a voice call with a hiring manager to get AI-powered question suggestions and a structured job summary.
          </p>
        </div>

        {/* Connection status */}
        <div className="flex justify-center mb-8">
          <ConnectionBadge state={connectionState} onReconnect={onReconnect} />
        </div>

        {/* Start Call Button */}
        {!joinUrl && (
          <div className="flex justify-center mb-6">
            <button
              onClick={onCreateRoom}
              disabled={connectionState !== "connected"}
              className="px-8 py-4 bg-[var(--accent)] text-white text-lg font-medium rounded-xl hover:bg-[var(--accent-hover)] transition-all disabled:opacity-50 disabled:cursor-not-allowed animate-breathe flex items-center gap-3"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              Start Voice Call
            </button>
          </div>
        )}

        {/* Join URL Card */}
        {joinUrl && (
          <div className="bg-white rounded-xl border border-[var(--border-color)] p-5 mb-6 animate-fade-in">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-[var(--success)]/10 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-[var(--success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">Share this link with the hiring manager</p>
                <p className="text-xs text-[var(--text-muted)]">They'll be able to join the call from their browser</p>
              </div>
            </div>
            <div className="flex gap-2">
              <input
                readOnly
                value={joinUrl}
                className="flex-1 px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm font-mono text-[var(--text-secondary)] truncate"
              />
              <button
                onClick={onCopyJoinUrl}
                className="px-4 py-2 bg-[var(--accent)] text-white text-sm rounded-lg hover:bg-[var(--accent-hover)] transition-colors flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy
              </button>
            </div>
          </div>
        )}

        {/* Text Mode Toggle */}
        <div className="text-center">
          <button
            onClick={() => setShowTextMode(!showTextMode)}
            className="text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
          >
            {showTextMode ? "Hide" : "Show"} Text Simulation Mode
          </button>
        </div>

        {/* Text Mode Input */}
        {showTextMode && (
          <div className="mt-4 bg-white rounded-xl border border-[var(--border-color)] p-4 animate-fade-in">
            <p className="text-xs text-[var(--text-muted)] mb-3">
              Simulate transcript input for testing without a voice call
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Type what the hiring manager says..."
                className="flex-1 px-3 py-2 border border-[var(--border-color)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
              />
              <button
                onClick={handleSend}
                disabled={!inputText.trim() || connectionState !== "connected"}
                className="px-4 py-2 bg-[var(--accent)] text-white text-sm rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Send
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ConnectionBadge({ state, onReconnect }: { state: ConnectionState; onReconnect: () => void }) {
  const config = {
    connected: { color: "bg-[var(--success)]", text: "Connected", textColor: "text-[var(--success)]" },
    connecting: { color: "bg-[var(--warning)] animate-pulse", text: "Connecting...", textColor: "text-[var(--warning)]" },
    disconnected: { color: "bg-[var(--text-muted)]", text: "Disconnected", textColor: "text-[var(--text-muted)]" },
    error: { color: "bg-[var(--error)]", text: "Error", textColor: "text-[var(--error)]" },
  };

  const c = config[state];

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-full border border-[var(--border-color)]">
      <div className={`w-2 h-2 rounded-full ${c.color}`} />
      <span className={`text-xs font-medium ${c.textColor}`}>{c.text}</span>
      {(state === "error" || state === "disconnected") && (
        <button onClick={onReconnect} className="text-xs text-[var(--accent)] hover:underline ml-1">
          Reconnect
        </button>
      )}
    </div>
  );
}
