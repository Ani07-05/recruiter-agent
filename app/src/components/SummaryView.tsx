import { JobSummary } from "../types";

interface SummaryViewProps {
  summary: JobSummary;
  onClose?: () => void;
}

export function SummaryView({ summary, onClose }: SummaryViewProps) {
  const handleExport = () => {
    const blob = new Blob([JSON.stringify(summary, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${summary.role_title.replace(/\s+/g, "_")}_requirements.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-lg border border-[var(--border-color)] p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 pb-4 border-b border-[var(--border-color)]">
        <div>
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">{summary.role_title}</h2>
          {summary.department && (
            <p className="text-sm text-[var(--text-secondary)] mt-1">{summary.department}</p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="px-3 py-1.5 text-sm bg-[var(--accent)] text-white rounded-md hover:bg-[var(--accent-hover)] transition-colors"
          >
            Export JSON
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-color)] rounded-md hover:bg-[var(--bg-tertiary)] transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Skills */}
        <Section title="Skills">
          {summary.skills.required.length > 0 && (
            <div className="mb-3">
              <h4 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-2">Required</h4>
              <div className="flex flex-wrap gap-1.5">
                {summary.skills.required.map((skill, i) => (
                  <Tag key={i} variant="required">{skill}</Tag>
                ))}
              </div>
            </div>
          )}
          {summary.skills.preferred.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-2">Preferred</h4>
              <div className="flex flex-wrap gap-1.5">
                {summary.skills.preferred.map((skill, i) => (
                  <Tag key={i} variant="preferred">{skill}</Tag>
                ))}
              </div>
            </div>
          )}
        </Section>

        {/* Experience */}
        {(summary.experience.min_years || summary.experience.max_years) && (
          <Section title="Experience">
            <p className="text-sm text-[var(--text-primary)]">
              {summary.experience.min_years && summary.experience.max_years
                ? `${summary.experience.min_years} - ${summary.experience.max_years} years`
                : summary.experience.min_years
                ? `${summary.experience.min_years}+ years`
                : `Up to ${summary.experience.max_years} years`}
            </p>
            {summary.experience.notes && (
              <p className="text-sm text-[var(--text-secondary)] mt-1">{summary.experience.notes}</p>
            )}
          </Section>
        )}

        {/* Responsibilities */}
        {summary.responsibilities.length > 0 && (
          <Section title="Responsibilities">
            <ul className="space-y-1.5">
              {summary.responsibilities.map((resp, i) => (
                <li key={i} className="text-sm text-[var(--text-primary)] flex items-start">
                  <span className="text-[var(--accent)] mr-2">•</span>
                  {resp}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Candidate Persona */}
        <Section title="Ideal Candidate">
          {summary.candidate_persona.must_haves.length > 0 && (
            <div className="mb-3">
              <h4 className="text-xs font-medium text-[var(--success)] mb-1.5">Must Haves</h4>
              <ul className="space-y-1">
                {summary.candidate_persona.must_haves.map((item, i) => (
                  <li key={i} className="text-sm text-[var(--text-primary)] flex items-start">
                    <span className="text-[var(--success)] mr-2">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {summary.candidate_persona.nice_to_haves.length > 0 && (
            <div className="mb-3">
              <h4 className="text-xs font-medium text-[var(--accent)] mb-1.5">Nice to Haves</h4>
              <ul className="space-y-1">
                {summary.candidate_persona.nice_to_haves.map((item, i) => (
                  <li key={i} className="text-sm text-[var(--text-primary)] flex items-start">
                    <span className="text-[var(--accent)] mr-2">○</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {summary.candidate_persona.red_flags.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-[var(--error)] mb-1.5">Red Flags</h4>
              <ul className="space-y-1">
                {summary.candidate_persona.red_flags.map((item, i) => (
                  <li key={i} className="text-sm text-[var(--text-primary)] flex items-start">
                    <span className="text-[var(--error)] mr-2">!</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>

        {/* Team Context */}
        {(summary.team_context.team_size || summary.team_context.tech_stack.length > 0) && (
          <Section title="Team Context">
            {summary.team_context.team_size && (
              <p className="text-sm text-[var(--text-primary)] mb-2">
                <span className="text-[var(--text-secondary)]">Team:</span> {summary.team_context.team_size}
              </p>
            )}
            {summary.team_context.project_description && (
              <p className="text-sm text-[var(--text-primary)] mb-2">
                <span className="text-[var(--text-secondary)]">Project:</span> {summary.team_context.project_description}
              </p>
            )}
            {summary.team_context.tech_stack.length > 0 && (
              <div>
                <span className="text-sm text-[var(--text-secondary)]">Tech Stack:</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {summary.team_context.tech_stack.map((tech, i) => (
                    <Tag key={i} variant="neutral">{tech}</Tag>
                  ))}
                </div>
              </div>
            )}
          </Section>
        )}

        {/* Location */}
        {(summary.location || summary.remote_policy) && (
          <Section title="Location">
            {summary.location && <p className="text-sm text-[var(--text-primary)]">{summary.location}</p>}
            {summary.remote_policy && <p className="text-sm text-[var(--text-secondary)]">{summary.remote_policy}</p>}
          </Section>
        )}
      </div>

      {/* Unclear Points */}
      {summary.unclear_points.length > 0 && (
        <div className="mt-6 p-4 bg-[#fffbeb] border border-[#fbbf24] rounded-lg">
          <h3 className="text-sm font-semibold text-[var(--warning)] mb-2">Follow-up Required</h3>
          <ul className="space-y-1.5">
            {summary.unclear_points.map((point, i) => (
              <li key={i} className="text-sm text-[var(--text-primary)] flex items-start">
                <span className="text-[var(--warning)] mr-2">?</span>
                {point}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-4 bg-[var(--bg-secondary)] rounded-lg">
      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">{title}</h3>
      {children}
    </div>
  );
}

function Tag({ children, variant }: { children: React.ReactNode; variant: "required" | "preferred" | "neutral" }) {
  const styles = {
    required: "bg-[#dcfce7] text-[#166534] border-[#bbf7d0]",
    preferred: "bg-[#dbeafe] text-[#1e40af] border-[#bfdbfe]",
    neutral: "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border-[var(--border-color)]",
  };

  return (
    <span className={`px-2 py-0.5 text-xs rounded border ${styles[variant]}`}>
      {children}
    </span>
  );
}
