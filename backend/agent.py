"""Claude/Groq Agent configuration for recruiter assistance."""

import os
import json
from typing import Callable, Any
from groq import Groq

from tools import ALL_TOOLS, process_tool_call
from prompts import RECRUITER_SYSTEM_PROMPT, SUMMARY_GENERATION_PROMPT
from models import SuggestedQuestion, JobSummary


def convert_tools_to_openai_format(tools: list[dict]) -> list[dict]:
    """Convert Anthropic-style tools to OpenAI/Groq format."""
    openai_tools = []
    for tool in tools:
        openai_tools.append({
            "type": "function",
            "function": {
                "name": tool["name"],
                "description": tool["description"],
                "parameters": tool["input_schema"]
            }
        })
    return openai_tools


class RecruiterSession:
    """Manages a conversation session with the Groq agent."""

    def __init__(
        self,
        on_suggestion: Callable[[SuggestedQuestion], Any] | None = None,
        on_summary: Callable[[JobSummary], Any] | None = None,
        model: str = "openai/gpt-oss-20b"
    ):
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            raise ValueError("GROQ_API_KEY environment variable required")

        self.client = Groq(api_key=api_key)
        self.model = model
        self.messages: list[dict] = []
        self.on_suggestion = on_suggestion
        self.on_summary = on_summary
        self.transcript_buffer: list[str] = []
        self.tools = convert_tools_to_openai_format(ALL_TOOLS)

    def _format_transcript_entry(self, text: str, speaker: str | None = None) -> str:
        """Format a transcript entry with optional speaker label."""
        if speaker:
            return f"[{speaker}]: {text}"
        return text

    async def process_transcript(self, text: str, speaker: str | None = None) -> list[dict]:
        """Process a transcript segment and potentially generate suggestions.

        Returns a list of tool outputs (suggestions or summaries).
        """
        # Add to buffer
        entry = self._format_transcript_entry(text, speaker)
        self.transcript_buffer.append(entry)

        # Create the user message with the new transcript
        user_message = f"New transcript segment:\n{entry}"

        self.messages.append({"role": "user", "content": user_message})

        outputs = []

        # Get response from Groq
        response = self.client.chat.completions.create(
            model=self.model,
            max_tokens=1024,
            messages=[
                {"role": "system", "content": RECRUITER_SYSTEM_PROMPT},
                *self.messages
            ],
            tools=self.tools,
            tool_choice="auto"
        )

        # Process the response
        message = response.choices[0].message

        while message.tool_calls:
            # Add assistant message with tool calls
            self.messages.append({
                "role": "assistant",
                "content": message.content,
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments
                        }
                    }
                    for tc in message.tool_calls
                ]
            })

            # Process each tool call
            for tool_call in message.tool_calls:
                tool_name = tool_call.function.name
                tool_input = json.loads(tool_call.function.arguments)

                result = process_tool_call(tool_name, tool_input)
                outputs.append(result)

                # Invoke callbacks
                if result["type"] == "suggestion" and self.on_suggestion:
                    suggestion = SuggestedQuestion(**result["data"])
                    await self._safe_callback(self.on_suggestion, suggestion)
                elif result["type"] == "summary" and self.on_summary:
                    summary = JobSummary(**result["data"])
                    await self._safe_callback(self.on_summary, summary)

                # Add tool result to messages
                self.messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": "Suggestion sent to recruiter." if result["type"] == "suggestion" else "Summary generated."
                })

            # Continue the conversation
            response = self.client.chat.completions.create(
                model=self.model,
                max_tokens=1024,
                messages=[
                    {"role": "system", "content": RECRUITER_SYSTEM_PROMPT},
                    *self.messages
                ],
                tools=self.tools,
                tool_choice="auto"
            )
            message = response.choices[0].message

        # Add final response to messages
        if message.content:
            self.messages.append({"role": "assistant", "content": message.content})

        return outputs

    async def generate_summary(self) -> JobSummary | None:
        """Generate the final job requirements summary."""
        # Build the full transcript context
        full_transcript = "\n".join(self.transcript_buffer)

        # Create the summary request
        summary_request = f"""{SUMMARY_GENERATION_PROMPT}

Full conversation transcript:
{full_transcript}

Please use the generate_summary tool to create the structured summary."""

        self.messages.append({"role": "user", "content": summary_request})

        response = self.client.chat.completions.create(
            model=self.model,
            max_tokens=4096,
            messages=[
                {"role": "system", "content": RECRUITER_SYSTEM_PROMPT},
                *self.messages
            ],
            tools=self.tools,
            tool_choice={"type": "function", "function": {"name": "generate_summary"}}
        )

        # Process the response to extract the summary
        message = response.choices[0].message
        if message.tool_calls:
            for tool_call in message.tool_calls:
                if tool_call.function.name == "generate_summary":
                    tool_input = json.loads(tool_call.function.arguments)
                    result = process_tool_call("generate_summary", tool_input)
                    if result["type"] == "summary":
                        summary = JobSummary(**result["data"])
                        if self.on_summary:
                            await self._safe_callback(self.on_summary, summary)
                        return summary

        return None

    async def _safe_callback(self, callback: Callable, *args):
        """Safely invoke a callback, handling both sync and async callbacks."""
        import asyncio
        result = callback(*args)
        if asyncio.iscoroutine(result):
            await result

    def get_transcript(self) -> str:
        """Get the full transcript buffer."""
        return "\n".join(self.transcript_buffer)

    def clear(self):
        """Clear the session state."""
        self.messages = []
        self.transcript_buffer = []


class RecruiterAgent:
    """Factory for creating recruiter sessions."""

    def __init__(self, model: str = "openai/gpt-oss-20b"):
        self.model = model

    def create_session(
        self,
        on_suggestion: Callable[[SuggestedQuestion], Any] | None = None,
        on_summary: Callable[[JobSummary], Any] | None = None
    ) -> RecruiterSession:
        """Create a new recruiter session."""
        return RecruiterSession(
            on_suggestion=on_suggestion,
            on_summary=on_summary,
            model=self.model
        )
