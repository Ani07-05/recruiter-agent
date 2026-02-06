import { useState, useCallback, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useVoiceCall } from "../hooks/useVoiceCall";
import { VoiceCallOverlay } from "../components/VoiceCallOverlay";
import { getApiUrl } from "../utils/api";

export function JoinCall() {
  const { roomId } = useParams<{ roomId: string }>();
  const [deepgramApiKey, setDeepgramApiKey] = useState<string>("");
  const [isCallActive, setIsCallActive] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);

  // Fetch config on mount
  useEffect(() => {
    fetch(getApiUrl("/api/config"))
      .then((res) => res.json())
      .then((data) => {
        setDeepgramApiKey(data.deepgram_api_key || "");
      })
      .catch((err) => console.error("Failed to fetch config:", err));
  }, []);

  const handleTranscript = useCallback((text: string, speaker: string, isFinal: boolean) => {
    if (isFinal && text.trim()) {
      console.log(`[${speaker}]: ${text}`);
      // In a real app, you might want to send this to a separate endpoint
      // or display it on screen for the hiring manager
    }
  }, []);

  const voiceCall = useVoiceCall({
    roomId: roomId || "",
    role: "hiring_manager",
    onTranscript: handleTranscript,
    deepgramApiKey,
  });

  const handleJoinCall = async () => {
    if (!roomId) return;
    
    setIsCallActive(true);
    setHasJoined(true);
    await voiceCall.startCall();
  };

  const handleEndCall = () => {
    voiceCall.endCall();
    setIsCallActive(false);
  };

  if (!roomId) {
    return (
      <div className="min-h-screen bg-[var(--bg-secondary)] flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-[var(--error)]/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[var(--error)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Invalid Link</h1>
          <p className="text-[var(--text-secondary)]">This call link is invalid or has expired.</p>
        </div>
      </div>
    );
  }

  if (!hasJoined) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[var(--accent)] to-[var(--accent-hover)] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-[var(--accent)]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
              Join Recruiter Call
            </h1>
            <p className="text-[var(--text-secondary)]">
              You've been invited to join a voice call to discuss the job requirements.
            </p>
          </div>

          <div className="bg-[var(--bg-secondary)] rounded-lg p-4 mb-6">
            <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-2">What to expect:</h2>
            <ul className="space-y-2 text-sm text-[var(--text-primary)]">
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-[var(--success)] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Voice-only conversation (no video)
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-[var(--success)] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Real-time transcription and AI assistance
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-[var(--success)] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Structured summary at the end
              </li>
            </ul>
          </div>

          <button
            onClick={handleJoinCall}
            className="w-full py-3 bg-[var(--accent)] text-white rounded-lg font-medium hover:bg-[var(--accent-hover)] transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            Join Call Now
          </button>

          <p className="text-xs text-center text-[var(--text-muted)] mt-4">
            Your browser will ask for microphone permission
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
        <div className="w-16 h-16 bg-[var(--success)]/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-[var(--success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
          Connected to Call
        </h1>
        <p className="text-[var(--text-secondary)] mb-6">
          You're now in the call. Use the controls below to manage your audio.
        </p>
      </div>

      {isCallActive && (
        <VoiceCallOverlay
          callState={voiceCall.callState}
          isMuted={voiceCall.isMuted}
          isRemoteConnected={voiceCall.isRemoteConnected}
          onToggleMute={voiceCall.toggleMute}
          onEndCall={handleEndCall}
          participantName="Recruiter"
        />
      )}
    </div>
  );
}
