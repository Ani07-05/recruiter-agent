import { useEffect, useState } from "react";
import { CallState } from "../hooks/useVoiceCall";

interface CallControlsProps {
  callState: CallState;
  isMuted: boolean;
  isRemoteConnected: boolean;
  onToggleMute: () => void;
  onEndCall: () => void;
  participantName?: string;
}

export function CallControls({
  callState,
  isMuted,
  isRemoteConnected,
  onToggleMute,
  onEndCall,
  participantName = "Participant",
}: CallControlsProps) {
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (callState !== "connected") return;
    const interval = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(interval);
  }, [callState]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-3">
      {/* Timer */}
      <span className="text-sm font-mono text-[var(--text-secondary)]">
        {callState === "connected" ? formatDuration(duration) : "--:--"}
      </span>

      {/* Audio waveform */}
      {!isMuted && callState === "connected" && (
        <div className="flex gap-0.5 items-center h-5">
          {[8, 16, 12, 20, 10].map((h, i) => (
            <div
              key={i}
              className="w-0.5 bg-[var(--accent)] rounded-full animate-sound-wave"
              style={{ height: `${h}px`, animationDelay: `${i * 120}ms` }}
            />
          ))}
        </div>
      )}

      {/* Mute button */}
      <button
        onClick={onToggleMute}
        disabled={callState !== "connected"}
        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
          isMuted
            ? "bg-[var(--error)] text-white"
            : "bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--border-color)]"
        } disabled:opacity-50`}
        title={isMuted ? "Unmute" : "Mute"}
      >
        {isMuted ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        )}
      </button>

      {/* End call button */}
      <button
        onClick={onEndCall}
        className="w-9 h-9 rounded-full bg-[var(--error)] hover:bg-red-700 text-white flex items-center justify-center transition-all"
        title="End Call"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
        </svg>
      </button>

      {/* Connection status */}
      <div className="flex items-center gap-1.5">
        <div
          className={`w-2 h-2 rounded-full ${
            callState === "connected" && isRemoteConnected
              ? "bg-[var(--success)] animate-pulse"
              : callState === "connected"
              ? "bg-[var(--warning)] animate-pulse"
              : callState === "connecting"
              ? "bg-[var(--warning)] animate-pulse"
              : "bg-[var(--text-muted)]"
          }`}
        />
        <span className="text-xs text-[var(--text-muted)]">
          {callState === "connected" && isRemoteConnected && `${participantName} connected`}
          {callState === "connected" && !isRemoteConnected && "Waiting..."}
          {callState === "connecting" && "Connecting..."}
          {callState === "error" && "Error"}
        </span>
      </div>
    </div>
  );
}
