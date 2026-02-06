/** Types for the recruiter agent frontend */

// Question suggestion types
export interface QuestionOption {
  label: string;
  description: string;
}

export interface SuggestedQuestion {
  question: string;
  options: QuestionOption[];
  context: string;
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

export interface SuggestionMessage {
  type: "suggestion";
  data: SuggestedQuestion;
}

export interface SummaryMessage {
  type: "summary";
  data: JobSummary;
}

export interface ErrorMessage {
  type: "error";
  message: string;
  code?: string;
}

export interface ClearedMessage {
  type: "cleared";
}

export type IncomingMessage =
  | SuggestionMessage
  | SummaryMessage
  | ErrorMessage
  | ClearedMessage;

export type OutgoingMessage = TranscriptMessage | EndCallMessage | { type: "clear" };

// Connection state
export type ConnectionState = "disconnected" | "connecting" | "connected" | "error";
