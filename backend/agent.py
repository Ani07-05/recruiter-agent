"""Recruiter Agent with state machine for paced, single-question-per-turn flow."""

import os
import json
import time
import asyncio
import logging
from enum import Enum
from typing import Callable, Any

from groq import Groq

from tools import ALL_TOOLS, process_tool_call
from prompts import RECRUITER_SYSTEM_PROMPT, SUMMARY_GENERATION_PROMPT, build_context_message
from models import SuggestedQuestion, JobSummary

logger = logging.getLogger(__name__)

# Max LLM exchanges (assistant+tool pairs) to keep in self.messages
MAX_MESSAGE_HISTORY = 3


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


class ConversationState(str, Enum):
    """State machine states for the recruiter agent."""
    LISTENING = "listening"           # Waiting for hiring manager to speak
    GENERATING = "generating"         # LLM call in progress
    QUESTION_SHOWN = "question_shown" # Question displayed, waiting for HM answer
    PROCESSING_ANSWER = "processing_answer"  # HM answered, processing context


class RecruiterSession:
    """Manages a conversation session with state machine pacing."""

    def __init__(
        self,
        on_suggestion: Callable[[SuggestedQuestion], Any] | None = None,
        on_summary: Callable[[JobSummary], Any] | None = None,
        on_state_change: Callable[[str], Any] | None = None,
        model: str = "llama-3.3-70b-versatile"
    ):
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            raise ValueError("GROQ_API_KEY environment variable required")

        self.client = Groq(api_key=api_key)
        self.model = model
        self.messages: list[dict] = []  # Only keeps recent LLM exchanges (trimmed)
        self.on_suggestion = on_suggestion
        self.on_summary = on_summary
        self.on_state_change = on_state_change
        self.transcript_buffer: list[str] = []  # Full rolling transcript (ground truth)
        self.tools = convert_tools_to_openai_format(ALL_TOOLS)

        # Question tracking — prevents re-asking and gives LLM context
        self.asked_questions: list[str] = []

        # State machine
        self.state = ConversationState.LISTENING
        self.current_question: SuggestedQuestion | None = None
        self.queued_transcript: list[tuple[str, str | None]] = []

        # Turn detection
        self.last_speaker: str | None = None
        self.last_final_transcript_time: float = 0
        self._turn_timer_task: asyncio.Task | None = None
        self.turn_silence_threshold: float = 1.5  # seconds of silence = turn complete

        # Generation lock — prevents concurrent LLM calls
        self._generation_lock = asyncio.Lock()

    async def _set_state(self, new_state: ConversationState):
        """Transition to a new state and notify."""
        old_state = self.state
        self.state = new_state
        logger.info(f"State: {old_state.value} -> {new_state.value}")
        if self.on_state_change:
            await self._safe_callback(self.on_state_change, new_state.value)

    def _is_filler_only(self, text: str) -> bool:
        """Check if text is only filler words."""
        filler_words = {
            "uh", "um", "ah", "hmm", "mhmm", "uh-huh", "yeah", "yep", "yes", "no",
            "okay", "ok", "alright", "sure", "right", "got", "gotcha", "nice",
            "oh", "well", "so", "like", "wait", "but", "and", "the", "is", "are",
            "it", "to", "from", "in", "on", "at", "for", "with", "this", "that"
        }
        words = text.lower().strip().replace(".", "").replace("?", "").replace("!", "").split()
        if not words:
            return True
        return all(word in filler_words for word in words)

    async def process_transcript(self, text: str, speaker: str | None = None, is_final: bool = True) -> list[dict]:
        """Process a transcript segment through the state machine.

        Key rules:
        - Recruiter speech: record but NEVER trigger LLM
        - Hiring manager speech: trigger question generation based on state
        - Only one question at a time, strict pacing
        """
        if not text or not text.strip():
            return []

        text = text.strip()

        # Always record to transcript buffer
        entry = f"[{speaker or 'unknown'}]: {text}"
        self.transcript_buffer.append(entry)

        # Track speaker and timing
        self.last_speaker = speaker
        if is_final:
            self.last_final_transcript_time = time.time()

        # --- Recruiter speech: record only, never trigger LLM ---
        if speaker == "recruiter":
            logger.info(f"Recruiter spoke: '{text[:60]}...' (recorded, no LLM)")
            # Recruiter speech is in transcript_buffer — that's enough context.
            # Do NOT add to self.messages (pollutes LLM history with noise).
            return []

        # --- Hiring manager speech ---
        # Skip filler
        if self._is_filler_only(text):
            logger.info(f"Skipped filler: '{text}'")
            return []

        logger.info(f"HM spoke: '{text[:80]}...' | State: {self.state.value}")

        # Handle based on current state
        if self.state == ConversationState.GENERATING:
            # Already generating, queue this transcript
            self.queued_transcript.append((text, speaker))
            logger.info(f"Queued transcript (LLM busy). Queue size: {len(self.queued_transcript)}")
            return []

        if self.state == ConversationState.QUESTION_SHOWN:
            # HM is answering our question! Transition to processing
            await self._set_state(ConversationState.PROCESSING_ANSWER)
            # Cancel any pending turn timer
            self._cancel_turn_timer()
            # Process the answer + generate next question
            return await self._generate_question(text, speaker, is_answer=True)

        if self.state == ConversationState.PROCESSING_ANSWER:
            # Still processing answer, queue
            self.queued_transcript.append((text, speaker))
            logger.info(f"Queued transcript (processing answer). Queue size: {len(self.queued_transcript)}")
            return []

        # State is LISTENING — start turn detection timer
        self._cancel_turn_timer()
        self.queued_transcript.append((text, speaker))

        # Start a timer: after 1.5s of silence, treat turn as complete and generate
        self._turn_timer_task = asyncio.create_task(
            self._turn_complete_timer()
        )
        return []

    async def _turn_complete_timer(self):
        """Wait for silence, then trigger question generation."""
        try:
            await asyncio.sleep(self.turn_silence_threshold)

            # Check that no new speech arrived during the wait
            time_since_last = time.time() - self.last_final_transcript_time
            if time_since_last < self.turn_silence_threshold and self.last_speaker == "hiring_manager":
                # More speech might be coming, restart timer
                self._turn_timer_task = asyncio.create_task(self._turn_complete_timer())
                return

            # Turn is complete — flush queued transcript and generate
            # Must check state AND acquire lock to prevent races
            if self.queued_transcript and self.state == ConversationState.LISTENING:
                merged_text = " ".join(text for text, _ in self.queued_transcript)
                speaker = self.queued_transcript[-1][1]  # Use last speaker
                self.queued_transcript = []

                if not self._is_filler_only(merged_text):
                    logger.info(f"Turn complete. Generating for: '{merged_text[:80]}...'")
                    await self._generate_question(merged_text, speaker)
        except asyncio.CancelledError:
            pass

    def _cancel_turn_timer(self):
        """Cancel any pending turn-complete timer."""
        if self._turn_timer_task and not self._turn_timer_task.done():
            self._turn_timer_task.cancel()
            self._turn_timer_task = None

    def _build_condensed_transcript(self, limit: int = 30) -> str:
        """Build a condensed transcript from the last N entries."""
        recent = self.transcript_buffer[-limit:]
        return "\n".join(recent)

    def _trim_messages(self):
        """Keep only the last MAX_MESSAGE_HISTORY LLM exchanges.

        Each exchange is: 1 user message + 1 assistant message + 1 tool message = 3 messages.
        We keep the last MAX_MESSAGE_HISTORY exchanges (i.e., 3 * MAX_MESSAGE_HISTORY messages).
        """
        max_msgs = MAX_MESSAGE_HISTORY * 3
        if len(self.messages) > max_msgs:
            self.messages = self.messages[-max_msgs:]

    async def _generate_question(self, text: str, speaker: str | None = None, is_answer: bool = False) -> list[dict]:
        """Generate a single question via LLM with streaming for speed."""
        # Acquire lock to prevent concurrent generation (race condition fix)
        async with self._generation_lock:
            # Re-check state under lock — another call may have started generating
            if self.state == ConversationState.GENERATING:
                # Already generating, queue this text instead
                self.queued_transcript.append((text, speaker))
                logger.info(f"Generation already in progress, queued. Queue size: {len(self.queued_transcript)}")
                return []

            start_time = time.time()

            await self._set_state(ConversationState.GENERATING)

            # Build the condensed context message (transcript + asked questions)
            context_msg = build_context_message(
                transcript=self._build_condensed_transcript(),
                asked_questions=self.asked_questions,
                new_text=text,
                is_answer=is_answer,
            )

            # Trim old LLM exchanges before adding new ones
            self._trim_messages()

            self.messages.append({"role": "user", "content": context_msg})

            outputs = []

            try:
                llm_start = time.time()
                messages_payload = [
                    {"role": "system", "content": RECRUITER_SYSTEM_PROMPT},
                    *self.messages
                ]
                logger.info(f"Calling LLM ({self.model}), {len(self.messages)} msgs, streaming...")

                # Run the synchronous streaming call in a thread to avoid blocking
                def _stream_llm():
                    return self.client.chat.completions.create(
                        model=self.model,
                        max_tokens=256,
                        temperature=0.5,
                        messages=messages_payload,
                        tools=self.tools,
                        tool_choice={"type": "function", "function": {"name": "suggest_question"}},
                        stream=True,
                    )

                stream = await asyncio.to_thread(_stream_llm)

                # Accumulate streamed tool call chunks
                tool_call_id = None
                tool_call_name = None
                tool_call_args = ""
                content_text = ""
                first_chunk_time = None

                def _consume_stream():
                    nonlocal tool_call_id, tool_call_name, tool_call_args, content_text, first_chunk_time
                    for chunk in stream:
                        if first_chunk_time is None:
                            first_chunk_time = time.time()
                        choice = chunk.choices[0] if chunk.choices else None
                        if not choice:
                            continue
                        delta = choice.delta
                        # Accumulate content text (usually empty with forced tool_choice)
                        if delta.content:
                            content_text += delta.content
                        # Accumulate tool call
                        if delta.tool_calls:
                            tc = delta.tool_calls[0]
                            if tc.id:
                                tool_call_id = tc.id
                            if tc.function:
                                if tc.function.name:
                                    tool_call_name = tc.function.name
                                if tc.function.arguments:
                                    tool_call_args += tc.function.arguments

                # Consume stream with a timeout to prevent hanging
                try:
                    await asyncio.wait_for(
                        asyncio.to_thread(_consume_stream),
                        timeout=15.0  # 15 second timeout for streaming
                    )
                except asyncio.TimeoutError:
                    logger.error("LLM streaming timed out after 15s")
                    await self._set_state(ConversationState.LISTENING)
                    return outputs

                ttft = (first_chunk_time - llm_start) * 1000 if first_chunk_time else 0
                llm_time = time.time() - llm_start
                logger.info(f"LLM streamed in {llm_time*1000:.0f}ms (TTFT: {ttft:.0f}ms)")
                logger.info(f"Stream result: tool_call_id={tool_call_id}, name={tool_call_name}, args_len={len(tool_call_args)}, content_len={len(content_text)}")

                # Process the accumulated tool call
                if tool_call_id and tool_call_name and tool_call_args:
                    tool_input = json.loads(tool_call_args)

                    result = process_tool_call(tool_call_name, tool_input)
                    outputs.append(result)

                    if result["type"] == "suggestion" and self.on_suggestion:
                        suggestion = SuggestedQuestion(**result["data"])
                        self.current_question = suggestion
                        # Track the question so we never re-ask it
                        self.asked_questions.append(suggestion.question)
                        logger.info(f"Question #{len(self.asked_questions)}: {suggestion.question[:80]}...")
                        await self._safe_callback(self.on_suggestion, suggestion)

                    # Add to message history
                    self.messages.append({
                        "role": "assistant",
                        "content": content_text or None,
                        "tool_calls": [{
                            "id": tool_call_id,
                            "type": "function",
                            "function": {
                                "name": tool_call_name,
                                "arguments": tool_call_args
                            }
                        }]
                    })
                    self.messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call_id,
                        "content": "Question shown to recruiter."
                    })

                    # Transition to QUESTION_SHOWN
                    await self._set_state(ConversationState.QUESTION_SHOWN)
                else:
                    # LLM didn't call tool (shouldn't happen with forced tool_choice, but handle gracefully)
                    if content_text:
                        self.messages.append({"role": "assistant", "content": content_text})
                    await self._set_state(ConversationState.LISTENING)

            except Exception as e:
                logger.error(f"LLM error: {e}", exc_info=True)
                await self._set_state(ConversationState.LISTENING)

            total_time = time.time() - start_time
            logger.info(f"Total generation time: {total_time*1000:.0f}ms")

        # Outside the lock: check if there's queued transcript to process
        if self.queued_transcript and self.state == ConversationState.LISTENING:
            merged = " ".join(text for text, _ in self.queued_transcript)
            last_speaker = self.queued_transcript[-1][1]
            self.queued_transcript = []
            if not self._is_filler_only(merged):
                # Directly await instead of create_task to go through the lock properly
                await self._generate_question(merged, last_speaker)

        return outputs

    async def notify_question_shown(self):
        """Called when the frontend confirms a question has been displayed."""
        if self.state == ConversationState.GENERATING:
            # Question was just generated, transition to shown
            await self._set_state(ConversationState.QUESTION_SHOWN)
        logger.info("Frontend confirmed question shown")

    async def generate_summary(self) -> JobSummary | None:
        """Generate the final job requirements summary."""
        self._cancel_turn_timer()

        full_transcript = "\n".join(self.transcript_buffer)

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
        result = callback(*args)
        if asyncio.iscoroutine(result):
            await result

    def get_transcript(self) -> str:
        """Get the full transcript buffer."""
        return "\n".join(self.transcript_buffer)

    def clear(self):
        """Clear the session state."""
        self._cancel_turn_timer()
        self.messages = []
        self.transcript_buffer = []
        self.queued_transcript = []
        self.asked_questions = []
        self.state = ConversationState.LISTENING
        self.current_question = None
        self.last_speaker = None
        self.last_final_transcript_time = 0


class RecruiterAgent:
    """Factory for creating recruiter sessions."""

    def __init__(self, model: str = "llama-3.3-70b-versatile"):
        self.model = model

    def create_session(
        self,
        on_suggestion: Callable[[SuggestedQuestion], Any] | None = None,
        on_summary: Callable[[JobSummary], Any] | None = None,
        on_state_change: Callable[[str], Any] | None = None
    ) -> RecruiterSession:
        """Create a new recruiter session."""
        return RecruiterSession(
            on_suggestion=on_suggestion,
            on_summary=on_summary,
            on_state_change=on_state_change,
            model=self.model
        )
