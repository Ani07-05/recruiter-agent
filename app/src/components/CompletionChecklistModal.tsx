import { CompletionStatus } from "../types";

interface CompletionChecklistModalProps {
  isOpen: boolean;
  status: CompletionStatus | null;
  onContinue: () => void;
  onEndCall: () => void;
}

export function CompletionChecklistModal({
  isOpen,
  status,
  onContinue,
  onEndCall,
}: CompletionChecklistModalProps) {
  if (!isOpen || !status) return null;

  const isComplete = status.progress >= 80;
  const phaseLabels = {
    1: "Phase 1: Business Mapping",
    2: "Phase 2: Requirements Confirmation",
    3: "Phase 3: Final Confirmation",
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border-color)]">
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">
            End Call Confirmation
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Review conversation completion before ending the call
          </p>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {/* Progress Bar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-[var(--text-primary)]">
                Overall Progress
              </span>
              <span className="text-sm font-semibold text-[var(--accent)]">
                {status.progress}%
              </span>
            </div>
            <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  isComplete ? "bg-[var(--success)]" : "bg-[var(--warning)]"
                }`}
                style={{ width: `${status.progress}%` }}
              />
            </div>
          </div>

          {/* Current Phase */}
          <div className="bg-[var(--bg-secondary)] rounded-lg p-4">
            <div className="text-sm font-medium text-[var(--text-primary)] mb-1">
              Current Phase
            </div>
            <div className="text-base font-semibold text-[var(--accent)]">
              {phaseLabels[status.phase as keyof typeof phaseLabels]}
            </div>
          </div>

          {/* Completed Items */}
          {status.completed_items.length > 0 && (
            <div>
              <div className="text-sm font-medium text-[var(--success)] mb-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                Completed ({status.completed_items.length})
              </div>
              <ul className="space-y-1">
                {status.completed_items.map((item, index) => (
                  <li
                    key={`completed-${index}`}
                    className="text-sm text-[var(--text-secondary)] flex items-start gap-2"
                  >
                    <svg
                      className="w-4 h-4 text-[var(--success)] mt-0.5 flex-shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Missing Items */}
          {status.missing_items.length > 0 && (
            <div>
              <div className="text-sm font-medium text-[var(--error)] mb-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                Missing ({status.missing_items.length})
              </div>
              <ul className="space-y-1">
                {status.missing_items.map((item, index) => (
                  <li
                    key={`missing-${index}`}
                    className="text-sm text-[var(--text-secondary)] flex items-start gap-2"
                  >
                    <svg
                      className="w-4 h-4 text-[var(--error)] mt-0.5 flex-shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Warning message if incomplete */}
          {!isComplete && (
            <div className="bg-[var(--warning-light)] border border-[var(--warning)] rounded-lg p-3 flex items-start gap-2">
              <svg
                className="w-5 h-5 text-[var(--warning)] flex-shrink-0 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <div className="text-sm font-medium text-[var(--warning)]">
                  Incomplete Conversation
                </div>
                <div className="text-xs text-[var(--text-secondary)] mt-1">
                  You may not have gathered all necessary information for a complete job spec.
                  Consider continuing the call to address missing items.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-[var(--border-color)] flex items-center justify-end gap-3">
          <button
            onClick={onContinue}
            className="px-4 py-2 text-sm font-medium text-[var(--text-primary)] bg-white border border-[var(--border-color)] rounded-lg hover:bg-[var(--bg-secondary)] transition-colors"
          >
            Continue Call
          </button>
          <button
            onClick={onEndCall}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              isComplete
                ? "bg-[var(--success)] text-white hover:bg-green-600"
                : "bg-[var(--error)] text-white hover:bg-red-600"
            }`}
          >
            {isComplete ? "End Call" : "End Anyway"}
          </button>
        </div>
      </div>
    </div>
  );
}
