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
        model: str = "openai/gpt-oss-120b"
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
        
        # Buffering for real-time transcripts
        self.pending_segments: list[tuple[str, str | None]] = []  # (text, speaker)
        self.min_words_to_process = 8  # Only process if buffer has 8+ words
        self.last_transcript_time = 0
        self.flush_timeout_seconds = 2.5  # Flush after 2.5s of silence

    def _format_transcript_entry(self, text: str, speaker: str | None = None) -> str:
        """Format a transcript entry with optional speaker label."""
        if speaker:
            return f"[{speaker}]: {text}"
        return text
    
    def _count_words(self, segments: list[tuple[str, str | None]]) -> int:
        """Count total words in pending segments."""
        return sum(len(text.split()) for text, _ in segments)
    
    def _is_filler_only(self, text: str) -> bool:
        """Check if text is only filler words (uh, yeah, mhmm, okay, etc)."""
        filler_words = {
            "uh", "um", "ah", "hmm", "mhmm", "uh-huh", "yeah", "yep", "yes", "no",
            "okay", "ok", "alright", "sure", "right", "got", "gotcha", "nice",
            "oh", "well", "so", "like", "wait", "but", "and", "the", "is", "are",
            "it", "to", "from", "in", "on", "at", "for", "with", "this", "that"
        }
        words = text.lower().strip().replace(".", "").replace("?", "").replace("!", "").split()
        if not words:
            return True
        # If all words are fillers, it's filler-only
        return all(word in filler_words for word in words)
    
    def _should_flush_buffer(self) -> bool:
        """Determine if we should flush pending segments to LLM."""
        import time
        
        if not self.pending_segments:
            return False
        
        # Check if we have enough words
        word_count = self._count_words(self.pending_segments)
        if word_count < self.min_words_to_process:
            # Not enough words yet, check if silence timeout reached
            time_since_last = time.time() - self.last_transcript_time
            return time_since_last >= self.flush_timeout_seconds
        
        # We have enough words, flush
        return True
    
    def _merge_pending_segments(self) -> str | None:
        """Merge pending segments into a single transcript entry, grouped by speaker."""
        if not self.pending_segments:
            return None
        
        # Group consecutive segments by speaker
        merged = []
        current_speaker = None
        current_text = []
        
        for text, speaker in self.pending_segments:
            if speaker != current_speaker:
                if current_text:
                    merged_text = " ".join(current_text).strip()
                    if merged_text and not self._is_filler_only(merged_text):
                        merged.append(self._format_transcript_entry(merged_text, current_speaker))
                current_speaker = speaker
                current_text = [text]
            else:
                current_text.append(text)
        
        # Don't forget the last group
        if current_text:
            merged_text = " ".join(current_text).strip()
            if merged_text and not self._is_filler_only(merged_text):
                merged.append(self._format_transcript_entry(merged_text, current_speaker))
        
        return "\n".join(merged) if merged else None

    async def process_transcript(self, text: str, speaker: str | None = None) -> list[dict]:
        """Process a transcript segment and potentially generate suggestions.
        
        Uses buffering to accumulate short fragments before sending to LLM.
        Only processes when enough words accumulate or after a pause in speech.

        Returns a list of tool outputs (suggestions or summaries).
        """
        import time
        
        # Skip completely empty or whitespace-only text
        if not text or not text.strip():
            return []
        
        # Skip if text is only filler words
        if self._is_filler_only(text):
            return []
        
        # Add to pending buffer
        self.pending_segments.append((text.strip(), speaker))
        self.last_transcript_time = time.time()
        
        # Check if we should flush
        if not self._should_flush_buffer():
            return []  # Keep buffering
        
        # Merge and process pending segments
        merged_entry = self._merge_pending_segments()
        self.pending_segments = []  # Clear buffer
        
        if not merged_entry:
            return []  # Nothing substantive to process
        
        # Add to permanent transcript buffer
        self.transcript_buffer.append(merged_entry)

        # Create the user message with the merged transcript
        user_message = f"New transcript segment:\n{merged_entry}"

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
        self.pending_segments = []
        self.last_transcript_time = 0


class RecruiterAgent:
    """Factory for creating recruiter sessions."""

    def __init__(self, model: str = "openai/gpt-oss-120b"):
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
