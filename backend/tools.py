"""Custom tool definitions for the recruiter agent."""

from typing import Any

# Tool definitions in Anthropic format
SUGGEST_QUESTION_TOOL = {
    "name": "suggest_question",
    "description": """Suggest a clarifying question for the recruiter to ask the hiring manager.
Use this tool when you identify gaps in the job requirements or unclear specifications.
The question should help gather specific, actionable information about the role.""",
    "input_schema": {
        "type": "object",
        "properties": {
            "question": {
                "type": "string",
                "description": "The question to ask the hiring manager"
            },
            "options": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "label": {
                            "type": "string",
                            "description": "Short label for the option"
                        },
                        "description": {
                            "type": "string",
                            "description": "Explanation of what this option means"
                        }
                    },
                    "required": ["label", "description"]
                },
                "minItems": 2,
                "maxItems": 4,
                "description": "Possible answer options to help guide the conversation"
            },
            "context": {
                "type": "string",
                "description": "Why this question is relevant based on what was just discussed"
            },
            "priority": {
                "type": "string",
                "enum": ["urgent", "high", "medium", "low"],
                "description": "Priority level: urgent (critical gap after significant time), high (vague statement needing clarification), medium (strengthens spec), low (nice-to-know)"
            },
            "category": {
                "type": "string",
                "enum": ["technical_requirements", "experience_level", "role_specifics", "culture_soft_skills", "logistics", "compensation", "team_context"],
                "description": "Which coverage area this question addresses"
            },
            "timing_hint": {
                "type": "string",
                "enum": ["ask_now", "ask_soon", "save_for_later"],
                "description": "When to ask: ask_now (topic is live), ask_soon (adjacent topic), save_for_later (different topic)"
            }
        },
        "required": ["question", "options", "context", "priority", "category", "timing_hint"]
    }
}

GENERATE_SUMMARY_TOOL = {
    "name": "generate_summary",
    "description": """Generate a comprehensive structured summary of the job requirements.
Use this tool at the end of the conversation to produce the final job requirements document.
Include all information gathered during the call, and note any areas that remain unclear.""",
    "input_schema": {
        "type": "object",
        "properties": {
            "role_title": {
                "type": "string",
                "description": "Job title"
            },
            "department": {
                "type": "string",
                "description": "Department or team name"
            },
            "reporting_to": {
                "type": "string",
                "description": "Who the role reports to"
            },
            "skills": {
                "type": "object",
                "properties": {
                    "required": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Must-have skills"
                    },
                    "preferred": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Nice-to-have skills"
                    }
                },
                "description": "Required and preferred skills"
            },
            "experience": {
                "type": "object",
                "properties": {
                    "min_years": {
                        "type": "integer",
                        "description": "Minimum years of experience"
                    },
                    "max_years": {
                        "type": "integer",
                        "description": "Maximum years of experience"
                    },
                    "notes": {
                        "type": "string",
                        "description": "Additional context about experience requirements"
                    }
                },
                "description": "Experience requirements"
            },
            "responsibilities": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Key job responsibilities"
            },
            "location": {
                "type": "string",
                "description": "Office location"
            },
            "remote_policy": {
                "type": "string",
                "description": "Remote/hybrid/onsite policy"
            },
            "compensation": {
                "type": "object",
                "properties": {
                    "salary_min": {"type": "integer"},
                    "salary_max": {"type": "integer"},
                    "currency": {"type": "string"},
                    "equity": {"type": "string"},
                    "benefits": {
                        "type": "array",
                        "items": {"type": "string"}
                    }
                },
                "description": "Compensation details"
            },
            "candidate_persona": {
                "type": "object",
                "properties": {
                    "must_haves": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Non-negotiable qualities"
                    },
                    "nice_to_haves": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Preferred but not required"
                    },
                    "cultural_fit": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Cultural fit indicators"
                    },
                    "red_flags": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Warning signs to avoid"
                    }
                },
                "description": "Ideal candidate profile"
            },
            "team_context": {
                "type": "object",
                "properties": {
                    "team_size": {"type": "string"},
                    "project_description": {"type": "string"},
                    "tech_stack": {
                        "type": "array",
                        "items": {"type": "string"}
                    },
                    "growth_plans": {"type": "string"},
                    "collaboration_style": {"type": "string"}
                },
                "description": "Team and project context"
            },
            "unclear_points": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Topics that were not discussed or remain unclear"
            },
            "additional_notes": {
                "type": "string",
                "description": "Any other relevant information"
            },
            "completeness_score": {
                "type": "integer",
                "minimum": 0,
                "maximum": 100,
                "description": "Overall completeness of the job requirements gathered (0-100)"
            }
        },
        "required": ["role_title", "skills", "responsibilities", "unclear_points", "completeness_score"]
    }
}

# List of all tools
ALL_TOOLS = [SUGGEST_QUESTION_TOOL, GENERATE_SUMMARY_TOOL]


def process_tool_call(tool_name: str, tool_input: dict[str, Any]) -> dict[str, Any]:
    """Process a tool call and return the result.

    In this case, the tools are used for structured output, so we just
    validate and return the input as the result.
    """
    if tool_name == "suggest_question":
        # Validate the question structure
        return {
            "status": "success",
            "type": "suggestion",
            "data": tool_input
        }
    elif tool_name == "generate_summary":
        # Validate the summary structure
        return {
            "status": "success",
            "type": "summary",
            "data": tool_input
        }
    else:
        return {
            "status": "error",
            "message": f"Unknown tool: {tool_name}"
        }
