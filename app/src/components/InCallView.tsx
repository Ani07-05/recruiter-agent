import { useRef, useEffect, useState, useCallback } from "react";
import { SuggestedQuestion, TranscriptLine, ConnectionState } from "../types";
import { CallState } from "../hooks/useVoiceCall";
import { AnimatedTranscriptLine } from "./TranscriptLine";
import { CallControls } from "./CallControls";
import { CoverageTracker } from "./CoverageTracker";
import { QuestionCard } from "./QuestionCard";

interface InCallViewProps {
  // Call state
  callState: CallState;
  isMuted: boolean;
  isRemoteConnected: boolean;
  onToggleMute: () => void;
  onEndCall: () => void;

  // Transcript
  transcriptLines: TranscriptLine[];
  onSaveTranscript: () => void;
  onClearTranscript: () => void;

  // Suggestions
  suggestions: SuggestedQuestion[];
  onDismissSuggestion: (index: number) => void;

  // Connection
  connectionState: ConnectionState;
}

export function InCallView({
  callState,
  isMuted,
  isRemoteConnected,
  onToggleMute,
  onEndCall,
  transcriptLines,
  onSaveTranscript,
  onClearTranscript,
  suggestions,
  onDismissSuggestion,
  connectionState,
}: InCallViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [userHasScrolled, setUserHasScrolled] = useState(false);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && !userHasScrolled && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcriptLines, autoScroll, userHasScrolled]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight) < 10;
    if (!atBottom && autoScroll) setUserHasScrolled(true);
    else if (atBottom) setUserHasScrolled(false);
  }, [autoScroll]);

  const handleJumpToLatest = useCallback(() => {
    setUserHasScrolled(false);
    setAutoScroll(true);
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, []);

  const finalLines = transcriptLines.filter((l) => l.isFinal);

  return (
    <div className="h-screen flex flex-col animate-phase-in">
      {/* Top Bar */}
      <div className="h-14 bg-white border-b border-[var(--border-color)] px-4 flex items-center justify-between flex-shrink-0">
        {/* Left: logo + live indicator */}
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-[var(--accent)] rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-[var(--error)] rounded-full animate-pulse" />
            <span className="text-sm font-medium text-[var(--text-primary)]">Live Call</span>
          </div>

          {/* WS Connection */}
          <div className="flex items-center gap-1.5 ml-2">
            <div className={`w-1.5 h-1.5 rounded-full ${
              connectionState === "connected" ? "bg-[var(--success)]" : "bg-[var(--warning)] animate-pulse"
            }`} />
            <span className="text-[10px] text-[var(--text-muted)]">
              AI {connectionState === "connected" ? "connected" : connectionState}
            </span>
          </div>
        </div>

        {/* Right: call controls */}
        <CallControls
          callState={callState}
          isMuted={isMuted}
          isRemoteConnected={isRemoteConnected}
          onToggleMute={onToggleMute}
          onEndCall={onEndCall}
          participantName="Hiring Manager"
        />
      </div>

      {/* Main Content */}
      <div className="flex flex-1 min-h-0">
        {/* Left Panel: Transcript (55%) */}
        <div className="flex flex-col" style={{ width: "55%" }}>
          {/* Transcript scroll area */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto bg-[var(--bg-secondary)]"
            onScroll={handleScroll}
          >
            {transcriptLines.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)]">
                <svg className="w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                <p className="text-sm font-medium">Waiting for conversation...</p>
                <p className="text-xs mt-1">Transcripts appear here in real-time</p>
              </div>
            ) : (
              <div className="py-3">
                {transcriptLines.map((line) => (
                  <AnimatedTranscriptLine key={line.id} line={line} />
                ))}
              </div>
            )}
          </div>

          {/* Transcript Footer */}
          <div className="h-11 border-t border-[var(--border-color)] px-4 flex items-center justify-between bg-white flex-shrink-0">
            <div className="flex items-center gap-2">
              {userHasScrolled ? (
                <button
                  onClick={handleJumpToLatest}
                  className="px-2.5 py-1 text-xs bg-[var(--accent)] text-white rounded hover:bg-[var(--accent-hover)] transition-colors flex items-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                  Latest
                </button>
              ) : (
                <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-[var(--success)] rounded-full animate-pulse" />
                  Auto-scroll
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-[var(--text-muted)]">{finalLines.length} lines</span>
              <button
                onClick={onSaveTranscript}
                disabled={finalLines.length === 0}
                className="px-2.5 py-1 text-xs bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded hover:bg-[var(--border-color)] transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                Save
              </button>
              <button
                onClick={onClearTranscript}
                disabled={transcriptLines.length === 0}
                className="px-2.5 py-1 text-xs bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded hover:bg-red-50 hover:text-[var(--error)] transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="panel-divider flex-shrink-0" />

        {/* Right Panel: Suggestions (45%) */}
        <div className="flex flex-col bg-white" style={{ width: "45%" }}>
          {/* Coverage Tracker */}
          <CoverageTracker suggestions={suggestions} />

          {/* Suggestion cards */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {suggestions.length > 0 ? (
              suggestions.map((suggestion, index) => (
                <QuestionCard
                  key={`${suggestion.question}-${index}`}
                  question={suggestion}
                  isNew={index === 0}
                  onDismiss={() => onDismissSuggestion(index)}
                />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)]">
                <svg className="w-10 h-10 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-medium">No suggestions yet</p>
                <p className="text-xs mt-1">AI will suggest questions as the conversation flows</p>
              </div>
            )}
          </div>

          {/* Bottom status */}
          {suggestions.length > 0 && (
            <div className="h-9 border-t border-[var(--border-color)] px-4 flex items-center justify-center flex-shrink-0">
              <span className="text-xs text-[var(--text-muted)]">
                {suggestions.length} suggestion{suggestions.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
