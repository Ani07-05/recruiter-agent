import { TranscriptLine } from "../types";

interface AnimatedTranscriptLineProps {
  line: TranscriptLine;
}

export function AnimatedTranscriptLine({ line }: AnimatedTranscriptLineProps) {
  const speakerConfig = {
    recruiter: { color: "var(--accent)", label: "Recruiter", icon: "R", bg: "bg-[var(--accent)]" },
    hiring_manager: { color: "var(--success)", label: "Hiring Manager", icon: "H", bg: "bg-[var(--success)]" },
  };

  const config = speakerConfig[line.speaker];

  return (
    <div className="animate-line mb-3 px-4 py-2">
      {/* Speaker label */}
      <div className="flex items-center gap-2 mb-1">
        <span
          className={`w-5 h-5 rounded-full ${config.bg} text-white text-[10px] font-bold flex items-center justify-center`}
        >
          {config.icon}
        </span>
        <span
          className="font-medium text-xs"
          style={{ color: config.color }}
        >
          {config.label}
        </span>
        {!line.isFinal && (
          <span className="text-xs text-[var(--text-muted)] italic">
            (typing...)
          </span>
        )}
      </div>

      {/* Animated words */}
      <div className="text-sm leading-relaxed pl-7">
        {line.words.map((wordObj, idx) => (
          <span
            key={`${line.id}-word-${idx}`}
            className={`animate-word ${
              line.isFinal ? "final-word" : "interim-word"
            }`}
            style={{
              animationDelay: `${idx * 50}ms`,
            }}
          >
            {wordObj.word}
          </span>
        ))}
      </div>
    </div>
  );
}
