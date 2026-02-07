import { SuggestedQuestion, QuestionPriority, QuestionCategory, TimingHint } from "../types";

interface QuestionCardProps {
  question: SuggestedQuestion;
  isNew?: boolean;
  onDismiss?: () => void;
}

const priorityConfig: Record<QuestionPriority, { color: string; bg: string; label: string; className?: string }> = {
  urgent: { color: "text-[var(--urgent)]", bg: "bg-red-50 border-red-200", label: "Urgent", className: "animate-urgent-pulse" },
  high: { color: "text-amber-600", bg: "bg-amber-50 border-amber-200", label: "High" },
  medium: { color: "text-[var(--accent)]", bg: "bg-indigo-50 border-indigo-200", label: "Medium" },
  low: { color: "text-[var(--text-muted)]", bg: "bg-gray-50 border-gray-200", label: "Low" },
};

const categoryLabels: Record<QuestionCategory, string> = {
  technical_requirements: "Technical",
  experience_level: "Experience",
  role_specifics: "Role",
  culture_soft_skills: "Culture",
  logistics: "Logistics",
  compensation: "Compensation",
  team_context: "Team",
};

const timingLabels: Record<TimingHint, { label: string; color: string }> = {
  ask_now: { label: "Ask now", color: "text-[var(--success)]" },
  ask_soon: { label: "Ask soon", color: "text-[var(--warning)]" },
  save_for_later: { label: "Later", color: "text-[var(--text-muted)]" },
};

export function QuestionCard({ question, isNew, onDismiss }: QuestionCardProps) {
  const priority = question.priority || "medium";
  const pConfig = priorityConfig[priority];
  const category = question.category;
  const timing = question.timing_hint;

  const handleCopyOption = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div
      className={`border rounded-lg p-3 bg-white ${
        isNew ? "animate-slide-in-right" : ""
      } ${pConfig.className || ""} ${
        priority === "urgent" ? "border-red-300" : "border-[var(--border-color)]"
      }`}
    >
      {/* Top row: priority badge + category + timing */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        {/* Priority badge */}
        <span
          className={`px-1.5 py-0.5 text-[10px] font-semibold uppercase rounded ${pConfig.bg} ${pConfig.color} border`}
        >
          {pConfig.label}
        </span>

        {/* Category tag */}
        {category && (
          <span className="px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-secondary)] bg-[var(--bg-tertiary)] rounded">
            {categoryLabels[category] || category}
          </span>
        )}

        {/* Timing hint */}
        {timing && (
          <span className={`text-[10px] font-medium ${timingLabels[timing].color} ml-auto`}>
            {timingLabels[timing].label}
          </span>
        )}
      </div>

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
            onClick={() => handleCopyOption(option.label)}
            className="p-2 rounded bg-[var(--bg-secondary)] border border-transparent hover:border-[var(--accent)] transition-colors cursor-pointer group"
            title="Click to copy"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--text-primary)]">
                {option.label}
              </span>
              <svg className="w-3 h-3 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
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
