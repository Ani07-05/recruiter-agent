"""Pydantic models for structured output."""

from typing import Optional, Literal
from pydantic import BaseModel, Field


# Question suggestion models
class QuestionOption(BaseModel):
    """An option for a clarifying question."""
    label: str = Field(description="Short label for the option (e.g., 'Entry-level (0-2 years)')")
    description: str = Field(description="Explanation of what this option means")


class SuggestedQuestion(BaseModel):
    """A clarifying question to ask the hiring manager."""
    question: str = Field(description="The question to ask")
    options: list[QuestionOption] = Field(
        description="2-4 possible answer options",
        min_length=2,
        max_length=4
    )
    context: str = Field(description="Why this question is relevant based on the conversation")
    priority: Literal["urgent", "high", "medium", "low"] = Field(
        default="medium",
        description="Priority level of the question"
    )
    category: Literal[
        "technical_requirements", "experience_level", "role_specifics",
        "culture_soft_skills", "logistics", "compensation", "team_context"
    ] = Field(
        default="role_specifics",
        description="Which coverage area this question addresses"
    )
    timing_hint: Literal["ask_now", "ask_soon", "save_for_later"] = Field(
        default="ask_now",
        description="When to ask this question"
    )


# Job summary models
class Skills(BaseModel):
    """Required and preferred skills for the role."""
    required: list[str] = Field(default_factory=list, description="Must-have skills")
    preferred: list[str] = Field(default_factory=list, description="Nice-to-have skills")


class ExperienceLevel(BaseModel):
    """Experience requirements for the role."""
    min_years: Optional[int] = Field(default=None, description="Minimum years of experience")
    max_years: Optional[int] = Field(default=None, description="Maximum years of experience")
    notes: Optional[str] = Field(default=None, description="Additional context about experience")


class CandidatePersona(BaseModel):
    """Ideal candidate profile."""
    must_haves: list[str] = Field(default_factory=list, description="Non-negotiable qualities")
    nice_to_haves: list[str] = Field(default_factory=list, description="Preferred but not required")
    cultural_fit: list[str] = Field(default_factory=list, description="Cultural fit indicators")
    red_flags: list[str] = Field(default_factory=list, description="Warning signs to avoid")


class TeamContext(BaseModel):
    """Team and project context."""
    team_size: Optional[str] = Field(default=None, description="Size and structure of the team")
    project_description: Optional[str] = Field(default=None, description="What they'll be working on")
    tech_stack: list[str] = Field(default_factory=list, description="Current technologies in use")
    growth_plans: Optional[str] = Field(default=None, description="Future roadmap context")
    collaboration_style: Optional[str] = Field(default=None, description="Agile, etc.")


class Compensation(BaseModel):
    """Compensation details."""
    salary_min: Optional[int] = Field(default=None, description="Minimum salary")
    salary_max: Optional[int] = Field(default=None, description="Maximum salary")
    currency: Optional[str] = Field(default="USD", description="Currency for salary")
    equity: Optional[str] = Field(default=None, description="Equity/stock options details")
    benefits: list[str] = Field(default_factory=list, description="Benefits mentioned")


class JobSummary(BaseModel):
    """Complete structured summary of job requirements."""
    role_title: str = Field(description="Job title")
    department: Optional[str] = Field(default=None, description="Department or team name")
    reporting_to: Optional[str] = Field(default=None, description="Who the role reports to")

    skills: Skills = Field(default_factory=Skills, description="Required and preferred skills")
    experience: ExperienceLevel = Field(default_factory=ExperienceLevel, description="Experience requirements")
    responsibilities: list[str] = Field(default_factory=list, description="Key job responsibilities")

    location: Optional[str] = Field(default=None, description="Office location")
    remote_policy: Optional[str] = Field(default=None, description="Remote/hybrid/onsite policy")

    compensation: Compensation = Field(default_factory=Compensation, description="Salary and benefits")

    candidate_persona: CandidatePersona = Field(
        default_factory=CandidatePersona,
        description="Ideal candidate profile"
    )
    team_context: TeamContext = Field(
        default_factory=TeamContext,
        description="Team and project context"
    )

    unclear_points: list[str] = Field(
        default_factory=list,
        description="Topics that were not discussed or remain unclear"
    )
    additional_notes: Optional[str] = Field(
        default=None,
        description="Any other relevant information from the conversation"
    )
    completeness_score: int = Field(
        default=0,
        ge=0,
        le=100,
        description="Overall completeness of the job requirements gathered (0-100)"
    )


# WebSocket message models
class TranscriptMessage(BaseModel):
    """Incoming transcript from STT."""
    type: str = Field(default="transcript")
    text: str = Field(description="Transcribed text")
    speaker: Optional[str] = Field(default=None, description="Speaker identifier (hiring_manager, recruiter)")
    timestamp: Optional[float] = Field(default=None, description="Timestamp in seconds")


class EndCallMessage(BaseModel):
    """Signal to end the call and generate summary."""
    type: str = Field(default="end_call")


class SuggestionMessage(BaseModel):
    """Outgoing question suggestion."""
    type: str = Field(default="suggestion")
    data: SuggestedQuestion


class SummaryMessage(BaseModel):
    """Outgoing job summary."""
    type: str = Field(default="summary")
    data: JobSummary


class StateChangeMessage(BaseModel):
    """Agent state change notification."""
    type: str = Field(default="state_change")
    state: str = Field(description="New agent state: listening, generating, question_shown, processing_answer")


class ErrorMessage(BaseModel):
    """Error message."""
    type: str = Field(default="error")
    message: str
    code: Optional[str] = Field(default=None)
