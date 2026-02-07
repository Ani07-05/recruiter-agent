import { useState, useCallback } from "react";
import { JobSummary, TranscriptLine } from "../types";
import { SummaryView } from "./SummaryView";

interface PostCallViewProps {
  summary: JobSummary | null;
  transcriptLines: TranscriptLine[];
  onNewSession: () => void;
}

export function PostCallView({ summary, transcriptLines, onNewSession }: PostCallViewProps) {
  const [showTranscript, setShowTranscript] = useState(false);

  const completeness = summary?.completeness_score ?? 0;

  const handleExportTranscript = useCallback(() => {
    const content = transcriptLines
      .filter((line) => line.isFinal)
      .map((line) => {
        const time = new Date(line.timestamp).toLocaleTimeString();
        const speaker = line.speaker === "recruiter" ? "Recruiter" : "Hiring Manager";
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

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] animate-phase-in">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-[var(--success)]/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-[var(--success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-display text-[var(--text-primary)] mb-2">Call Complete</h1>
          <p className="text-[var(--text-secondary)]">
            Here's the structured summary from your conversation.
          </p>
        </div>

        {/* Completeness Score */}
        {summary && (
          <div className="bg-white rounded-xl border border-[var(--border-color)] p-5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-[var(--text-primary)]">Requirements Completeness</span>
              <span className="text-2xl font-bold text-[var(--accent)]">{completeness}%</span>
            </div>
            <div className="h-3 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000 animate-fill-bar"
                style={{
                  width: `${completeness}%`,
                  backgroundColor:
                    completeness >= 80
                      ? "var(--success)"
                      : completeness >= 50
                      ? "var(--warning)"
                      : "var(--error)",
                }}
              />
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-2">
              {completeness >= 80
                ? "Great coverage! Most key areas have been addressed."
                : completeness >= 50
                ? "Decent coverage, but some areas could use more detail."
                : "Several key areas were not fully covered. Consider a follow-up."}
            </p>
          </div>
        )}

        {/* Summary */}
        {summary ? (
          <SummaryView summary={summary} />
        ) : (
          <div className="bg-white rounded-xl border border-[var(--border-color)] p-8 text-center">
            <div className="w-12 h-12 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-[var(--text-secondary)]">Generating summary...</p>
          </div>
        )}

        {/* Transcript Section */}
        {transcriptLines.length > 0 && (
          <div className="mt-6">
            <button
              onClick={() => setShowTranscript(!showTranscript)}
              className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors mb-3"
            >
              <svg
                className={`w-4 h-4 transition-transform ${showTranscript ? "rotate-90" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              View Full Transcript ({transcriptLines.filter((l) => l.isFinal).length} lines)
            </button>

            {showTranscript && (
              <div className="bg-white rounded-xl border border-[var(--border-color)] p-4 max-h-96 overflow-y-auto animate-fade-in">
                {transcriptLines
                  .filter((l) => l.isFinal)
                  .map((line) => (
                    <div key={line.id} className="mb-3 text-sm">
                      <span
                        className="font-medium text-xs"
                        style={{
                          color: line.speaker === "recruiter" ? "var(--accent)" : "var(--success)",
                        }}
                      >
                        {line.speaker === "recruiter" ? "Recruiter" : "Hiring Manager"}
                      </span>
                      <p className="text-[var(--text-primary)] mt-0.5">{line.text}</p>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-3 mt-8">
          {summary && (
            <button
              onClick={() => {
                const blob = new Blob([JSON.stringify(summary, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${summary.role_title.replace(/\s+/g, "_")}_requirements.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="px-4 py-2 text-sm bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export JSON
            </button>
          )}

          {transcriptLines.length > 0 && (
            <button
              onClick={handleExportTranscript}
              className="px-4 py-2 text-sm border border-[var(--border-color)] text-[var(--text-secondary)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export Transcript
            </button>
          )}

          <button
            onClick={onNewSession}
            className="px-4 py-2 text-sm border border-[var(--border-color)] text-[var(--text-secondary)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Start New Session
          </button>
        </div>
      </div>
    </div>
  );
}
