/** Types for the recruiter agent frontend */

// Question suggestion types
export interface QuestionOption {
  label: string;
  description: string;
}

export type QuestionPriority = "urgent" | "high" | "medium" | "low";
export type QuestionCategory =
  | "technical_requirements"
  | "experience_level"
  | "role_specifics"
  | "culture_soft_skills"
  | "logistics"
  | "compensation"
  | "team_context";
export type TimingHint = "ask_now" | "ask_soon" | "save_for_later";

// Agent state machine
export type AgentState = "listening" | "generating" | "question_shown" | "processing_answer";

export interface SuggestedQuestion {
  question: string;
  options: QuestionOption[];
  context: string;
  priority?: QuestionPriority;
  category?: QuestionCategory;
  timing_hint?: TimingHint;
}

// Job summary types
export interface Skills {
  required: string[];
  preferred: string[];
}

export interface ExperienceLevel {
  min_years?: number;
  max_years?: number;
  notes?: string;
}

export interface CandidatePersona {
  must_haves: string[];
  nice_to_haves: string[];
  cultural_fit: string[];
  red_flags: string[];
}

export interface TeamContext {
  team_size?: string;
  project_description?: string;
  tech_stack: string[];
  growth_plans?: string;
  collaboration_style?: string;
}

export interface Compensation {
  salary_min?: number;
  salary_max?: number;
  currency?: string;
  equity?: string;
  benefits: string[];
}

export interface JobSummary {
  role_title: string;
  department?: string;
  reporting_to?: string;
  skills: Skills;
  experience: ExperienceLevel;
  responsibilities: string[];
  location?: string;
  remote_policy?: string;
  compensation: Compensation;
  candidate_persona: CandidatePersona;
  team_context: TeamContext;
  unclear_points: string[];
  additional_notes?: string;
  completeness_score?: number;
}

// WebSocket message types
export interface TranscriptMessage {
  type: "transcript";
  text: string;
  speaker?: string;
  timestamp?: number;
}

export interface EndCallMessage {
  type: "end_call";
}

export interface GenerateQuestionMessage {
  type: "generate_question";
}

export interface GetCompletionStatusMessage {
  type: "get_completion_status";
}

export interface SuggestionMessage {
  type: "suggestion";
  data: SuggestedQuestion;
}

export interface SummaryMessage {
  type: "summary";
  data: JobSummary;
}

export interface CompletionStatus {
  phase: 1 | 2 | 3;
  completed_items: string[];
  missing_items: string[];
  progress: number;
}

export interface CompletionStatusMessage {
  type: "completion_status";
  data: CompletionStatus;
}

export interface ErrorMessage {
  type: "error";
  message: string;
  code?: string;
}

export interface ClearedMessage {
  type: "cleared";
}

export interface StateChangeMessage {
  type: "state_change";
  state: AgentState;
}

export type IncomingMessage =
  | SuggestionMessage
  | SummaryMessage
  | CompletionStatusMessage
  | ErrorMessage
  | ClearedMessage
  | StateChangeMessage;

export type OutgoingMessage = 
  | TranscriptMessage 
  | EndCallMessage 
  | GenerateQuestionMessage
  | GetCompletionStatusMessage
  | { type: "clear" } 
  | { type: "question_shown" };

// Connection state
export type ConnectionState = "disconnected" | "connecting" | "connected" | "error";

// Transcript overlay types
export interface TranscriptWord {
  word: string;
  startTime: number;
  isInterim?: boolean;
}

export interface TranscriptLine {
  id: string;
  speaker: "recruiter" | "hiring_manager";
  words: TranscriptWord[];
  text: string;
  timestamp: number;
  isFinal: boolean;
}

// AppPhase for phase-driven layout
export type AppPhase = "pre-call" | "in-call" | "post-call";
