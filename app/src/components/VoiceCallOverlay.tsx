import { useEffect, useState } from "react";
import { CallState } from "../hooks/useVoiceCall";

interface VoiceCallOverlayProps {
  callState: CallState;
  isMuted: boolean;
  isRemoteConnected: boolean;
  onToggleMute: () => void;
  onEndCall: () => void;
  participantName?: string;
  callDuration?: number;
}

export function VoiceCallOverlay({
  callState,
  isMuted,
  isRemoteConnected,
  onToggleMute,
  onEndCall,
  participantName = "Hiring Manager",
  callDuration = 0,
}: VoiceCallOverlayProps) {
  const [duration, setDuration] = useState(callDuration);

  useEffect(() => {
    if (callState !== "connected") return;

    const interval = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [callState]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (callState === "idle") return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
      <div className="bg-white rounded-2xl shadow-2xl border border-[var(--border-color)] overflow-hidden min-w-[400px]">
        {/* Header */}
        <div className="bg-gradient-to-r from-[var(--accent)] to-[var(--accent-hover)] px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                {isRemoteConnected && (
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white" />
                )}
              </div>
              <div className="text-white">
                <p className="font-medium">{participantName}</p>
                <p className="text-sm text-white/80">
                  {callState === "connecting" && "Connecting..."}
                  {callState === "connected" && isRemoteConnected && formatDuration(duration)}
                  {callState === "connected" && !isRemoteConnected && "Waiting..."}
                  {callState === "error" && "Connection Error"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {callState === "connected" && (
                <div className="flex items-center gap-1 text-white/90 text-xs">
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                  <span>Live</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Call Status */}
        {callState === "connecting" && (
          <div className="px-6 py-3 bg-[var(--bg-tertiary)] border-b border-[var(--border-color)]">
            <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <div className="w-4 h-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
              <span>Establishing connection...</span>
            </div>
          </div>
        )}

        {callState === "connected" && !isRemoteConnected && (
          <div className="px-6 py-3 bg-[var(--warning)]/10 border-b border-[var(--border-color)]">
            <div className="flex items-center gap-2 text-sm text-[var(--warning)]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Waiting for {participantName} to join...</span>
            </div>
          </div>
        )}

        {callState === "error" && (
          <div className="px-6 py-3 bg-[var(--error)]/10 border-b border-[var(--border-color)]">
            <div className="flex items-center gap-2 text-sm text-[var(--error)]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Connection failed. Please check your settings.</span>
            </div>
          </div>
        )}

        {/* Call Controls */}
        <div className="px-6 py-4 bg-[var(--bg-secondary)]">
          <div className="flex items-center justify-center gap-4">
            {/* Mute Button */}
            <button
              onClick={onToggleMute}
              disabled={callState !== "connected"}
              className={`
                w-14 h-14 rounded-full flex items-center justify-center transition-all
                ${isMuted 
                  ? "bg-[var(--error)] hover:bg-[var(--error)]/90 text-white" 
                  : "bg-white hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)]"
                }
                disabled:opacity-50 disabled:cursor-not-allowed
                shadow-md hover:shadow-lg
              `}
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clipRule="evenodd" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              )}
            </button>

            {/* End Call Button */}
            <button
              onClick={onEndCall}
              className="w-16 h-16 rounded-full bg-[var(--error)] hover:bg-[var(--error)]/90 text-white flex items-center justify-center transition-all shadow-md hover:shadow-lg scale-110"
              title="End Call"
            >
              <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                <path d="M16.707 2.293A1 1 0 0015.293 3.707L17.586 6H11a6 6 0 00-6 6v4a1 1 0 102 0v-4a4 4 0 014-4h6.586l-2.293 2.293a1 1 0 101.414 1.414l4-4a1 1 0 000-1.414l-4-4zM19 16a1 1 0 011 1v1a2 2 0 01-2 2H6a2 2 0 01-2-2v-1a1 1 0 112 0v1h12v-1a1 1 0 011-1z" />
              </svg>
            </button>

            {/* Audio Indicator */}
            <div className="w-14 h-14 rounded-full bg-white shadow-md flex items-center justify-center">
              {!isMuted && callState === "connected" && (
                <div className="flex gap-1 items-center">
                  <div className="w-1 bg-[var(--accent)] rounded-full animate-sound-wave" style={{ height: "8px", animationDelay: "0ms" }} />
                  <div className="w-1 bg-[var(--accent)] rounded-full animate-sound-wave" style={{ height: "16px", animationDelay: "150ms" }} />
                  <div className="w-1 bg-[var(--accent)] rounded-full animate-sound-wave" style={{ height: "12px", animationDelay: "300ms" }} />
                  <div className="w-1 bg-[var(--accent)] rounded-full animate-sound-wave" style={{ height: "20px", animationDelay: "450ms" }} />
                </div>
              )}
              {(isMuted || callState !== "connected") && (
                <svg className="w-6 h-6 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              )}
            </div>
          </div>

          {/* Status text */}
          <div className="mt-3 text-center">
            <p className="text-xs text-[var(--text-muted)]">
              {isMuted && "Microphone muted"}
              {!isMuted && callState === "connected" && "Microphone active • Transcribing..."}
              {callState !== "connected" && "Setting up call..."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
