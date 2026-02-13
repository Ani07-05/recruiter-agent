import { CallState } from "../hooks/useVoiceCall";
import { AgentState } from "../types";

interface GenerateQuestionButtonProps {
  onGenerateQuestion: () => void;
  agentState: AgentState;
  callState: CallState;
}

export function GenerateQuestionButton({
  onGenerateQuestion,
  agentState,
  callState,
}: GenerateQuestionButtonProps) {
  const isGenerating = agentState === "generating";
  const isDisabled = isGenerating || callState !== "connected";

  return (
    <button
      onClick={onGenerateQuestion}
      disabled={isDisabled}
      className={`fixed bottom-8 right-8 w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all z-50 ${
        isDisabled
          ? "bg-gray-300 cursor-not-allowed"
          : "bg-[var(--accent)] hover:bg-[var(--accent-hover)] hover:scale-110 active:scale-95"
      }`}
      title={isGenerating ? "Generating question..." : "Generate question"}
    >
      {isGenerating ? (
        <svg
          className="w-8 h-8 text-white animate-spin"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : (
        <svg
          className="w-8 h-8 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      )}
    </button>
  );
}
