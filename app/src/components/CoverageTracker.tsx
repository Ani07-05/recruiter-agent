import { useMemo } from "react";
import { SuggestedQuestion, QuestionCategory } from "../types";

interface CoverageTrackerProps {
  suggestions: SuggestedQuestion[];
}

const CATEGORIES: { key: QuestionCategory; label: string; color: string }[] = [
  { key: "technical_requirements", label: "Tech", color: "#4f46e5" },
  { key: "experience_level", label: "Exp", color: "#7c3aed" },
  { key: "role_specifics", label: "Role", color: "#2563eb" },
  { key: "culture_soft_skills", label: "Culture", color: "#0891b2" },
  { key: "logistics", label: "Logistics", color: "#059669" },
  { key: "compensation", label: "Comp", color: "#d97706" },
  { key: "team_context", label: "Team", color: "#dc2626" },
];

export function CoverageTracker({ suggestions }: CoverageTrackerProps) {
  const coverage = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of suggestions) {
      if (s.category) {
        counts[s.category] = (counts[s.category] || 0) + 1;
      }
    }

    const maxPerCategory = 3; // 3+ suggestions = "fully covered"
    return CATEGORIES.map((cat) => ({
      ...cat,
      count: counts[cat.key] || 0,
      pct: Math.min(100, ((counts[cat.key] || 0) / maxPerCategory) * 100),
    }));
  }, [suggestions]);

  const totalCovered = coverage.filter((c) => c.count > 0).length;

  return (
    <div className="px-4 py-3 bg-white border-b border-[var(--border-color)]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-[var(--text-secondary)]">Coverage</span>
        <span className="text-xs text-[var(--text-muted)]">
          {totalCovered}/{CATEGORIES.length} areas
        </span>
      </div>
      <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-[var(--bg-tertiary)]">
        {coverage.map((cat) => (
          <div
            key={cat.key}
            className="h-full rounded-full transition-all duration-500 animate-fill-bar"
            style={{
              width: `${100 / CATEGORIES.length}%`,
              backgroundColor: cat.count > 0 ? cat.color : "transparent",
              opacity: cat.count > 0 ? Math.min(1, 0.4 + cat.pct * 0.006) : 0,
            }}
            title={`${cat.label}: ${cat.count} question${cat.count !== 1 ? "s" : ""}`}
          />
        ))}
      </div>
      <div className="flex gap-2 mt-2 flex-wrap">
        {coverage.map((cat) => (
          <span
            key={cat.key}
            className={`text-[10px] ${cat.count > 0 ? "text-[var(--text-secondary)] font-medium" : "text-[var(--text-muted)]"}`}
          >
            {cat.label}
            {cat.count > 0 && (
              <span className="ml-0.5 font-normal">({cat.count})</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
