import { SuggestedQuestion } from "../types";

interface QuestionCardProps {
  question: SuggestedQuestion;
  isNew?: boolean;
  onDismiss?: () => void;
}

export function QuestionCard({ question, isNew, onDismiss }: QuestionCardProps) {
  return (
    <div className={`border border-[var(--border-color)] rounded-lg p-3 bg-white ${isNew ? "animate-fade-in" : ""}`}>
      {/* Context */}
      <p className="text-xs text-[var(--text-muted)] mb-2 italic">
        {question.context}
      </p>

      {/* Question */}
      <p className="text-sm font-medium text-[var(--text-primary)] mb-3">
        {question.question}
      </p>

      {/* Options */}
      <div className="space-y-1.5">
        {question.options.map((option, index) => (
          <div
            key={index}
            className="p-2 rounded bg-[var(--bg-secondary)] border border-transparent hover:border-[var(--accent)] transition-colors cursor-pointer"
          >
            <span className="text-xs font-medium text-[var(--text-primary)]">
              {option.label}
            </span>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{option.description}</p>
          </div>
        ))}
      </div>

      {/* Dismiss button */}
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="mt-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}
