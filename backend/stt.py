"""Speech-to-text integration for real-time transcription.

This module provides real-time STT using Deepgram's WebSocket API.
"""

import asyncio
import logging
import os
from abc import ABC, abstractmethod
from typing import Callable, Any

logger = logging.getLogger(__name__)


class STTProvider(ABC):
    """Abstract base class for STT providers."""

    @abstractmethod
    async def connect(self) -> bool:
        """Establish connection to the STT service."""
        pass

    @abstractmethod
    async def send_audio(self, audio_data: bytes):
        """Send audio data for transcription."""
        pass

    @abstractmethod
    async def close(self):
        """Close the connection."""
        pass

    @property
    @abstractmethod
    def is_connected(self) -> bool:
        """Check if connected to the STT service."""
        pass


class DeepgramSTT(STTProvider):
    """Real-time speech-to-text using Deepgram SDK v5.

    Uses the WebSocket streaming API for low-latency transcription.
    """

    def __init__(
        self,
        api_key: str | None = None,
        on_transcript: Callable[[str, str | None, bool], Any] | None = None,
        model: str = "nova-2",
        language: str = "en",
        sample_rate: int = 16000,
    ):
        """Initialize Deepgram STT client.

        Args:
            api_key: Deepgram API key (defaults to DEEPGRAM_API_KEY env var)
            on_transcript: Callback for transcripts (text, speaker, is_final)
            model: Deepgram model to use (default: nova-2)
            language: Language code (default: en)
            sample_rate: Audio sample rate in Hz (default: 16000)
        """
        self.api_key = api_key or os.environ.get("DEEPGRAM_API_KEY")
        if not self.api_key:
            raise ValueError("Deepgram API key required. Set DEEPGRAM_API_KEY env var or pass api_key.")

        self.on_transcript = on_transcript
        self.model = model
        self.language = language
        self.sample_rate = sample_rate
        self._is_connected = False
        self._connection = None
        self._client = None

    async def connect(self) -> bool:
        """Establish connection to Deepgram streaming API."""
        try:
            from deepgram import DeepgramClient
            from deepgram.core.events import EventType

            self._client = DeepgramClient(api_key=self.api_key)

            # Connect using the v2 WebSocket API
            self._connection = self._client.listen.v2.connect(
                model=self.model,
                language=self.language,
                encoding="linear16",
                sample_rate=str(self.sample_rate),
                punctuate=True,
                diarize=True,
                interim_results=True,
            )

            # Register event handlers
            self._connection.on(EventType.OPEN, self._on_open)
            self._connection.on(EventType.MESSAGE, self._on_message)
            self._connection.on(EventType.ERROR, self._on_error)
            self._connection.on(EventType.CLOSE, self._on_close)

            # Start the connection
            await self._connection.start_listening()
            self._is_connected = True
            logger.info("Connected to Deepgram")
            return True

        except ImportError as e:
            logger.error(f"Deepgram SDK not installed or import error: {e}")
            return False
        except Exception as e:
            logger.error(f"Error connecting to Deepgram: {e}")
            return False

    async def send_audio(self, audio_data: bytes):
        """Send audio data to Deepgram for transcription.

        Args:
            audio_data: Raw audio bytes (16-bit PCM at configured sample rate)
        """
        if self._connection and self._is_connected:
            try:
                await self._connection.send(audio_data)
            except Exception as e:
                logger.error(f"Error sending audio: {e}")

    async def close(self):
        """Close the Deepgram connection."""
        if self._connection:
            try:
                await self._connection.finish()
            except Exception as e:
                logger.error(f"Error closing connection: {e}")
        self._is_connected = False
        self._connection = None
        logger.info("Deepgram connection closed")

    @property
    def is_connected(self) -> bool:
        """Check if connected to Deepgram."""
        return self._is_connected

    def _on_open(self, *args, **kwargs):
        """Handle connection open event."""
        logger.info("Deepgram WebSocket connection opened")

    def _on_message(self, message, *args, **kwargs):
        """Handle incoming transcript message."""
        try:
            # Extract transcript from the message
            if hasattr(message, 'channel') and message.channel:
                alternatives = message.channel.alternatives
                if alternatives and len(alternatives) > 0:
                    transcript = alternatives[0].transcript
                    if transcript:
                        is_final = getattr(message, 'is_final', True)

                        # Extract speaker from diarization if available
                        speaker = None
                        words = getattr(alternatives[0], 'words', None)
                        if words and len(words) > 0:
                            speaker_id = getattr(words[0], 'speaker', None)
                            if speaker_id is not None:
                                speaker = f"speaker_{speaker_id}"

                        # Invoke callback
                        if self.on_transcript:
                            self._invoke_callback(transcript, speaker, is_final)

        except Exception as e:
            logger.error(f"Error processing message: {e}")

    def _on_error(self, error, *args, **kwargs):
        """Handle error event."""
        logger.error(f"Deepgram error: {error}")

    def _on_close(self, *args, **kwargs):
        """Handle connection close event."""
        self._is_connected = False
        logger.info("Deepgram WebSocket connection closed")

    def _invoke_callback(self, text: str, speaker: str | None, is_final: bool):
        """Invoke the transcript callback."""
        if self.on_transcript:
            try:
                result = self.on_transcript(text, speaker, is_final)
                if asyncio.iscoroutine(result):
                    asyncio.create_task(result)
            except Exception as e:
                logger.error(f"Error in transcript callback: {e}")


class MockSTT(STTProvider):
    """Mock STT provider for testing without an actual STT service."""

    def __init__(
        self,
        on_transcript: Callable[[str, str | None, bool], Any] | None = None,
    ):
        self.on_transcript = on_transcript
        self._is_connected = False

    async def connect(self) -> bool:
        self._is_connected = True
        logger.info("Mock STT connected")
        return True

    async def send_audio(self, audio_data: bytes):
        pass

    async def close(self):
        self._is_connected = False
        logger.info("Mock STT disconnected")

    @property
    def is_connected(self) -> bool:
        return self._is_connected

    async def simulate_transcript(self, text: str, speaker: str | None = None):
        """Simulate receiving a transcript for testing."""
        if self.on_transcript:
            result = self.on_transcript(text, speaker, True)
            if asyncio.iscoroutine(result):
                await result


class AudioCapture(ABC):
    """Abstract base class for audio capture implementations."""

    @abstractmethod
    async def start(self):
        """Start capturing audio."""
        pass

    @abstractmethod
    async def stop(self):
        """Stop capturing audio."""
        pass

    @abstractmethod
    async def read(self) -> bytes | None:
        """Read audio data."""
        pass


class MicrophoneCapture(AudioCapture):
    """Capture audio from microphone using sounddevice.

    Requires: pip install sounddevice numpy
    """

    def __init__(
        self,
        sample_rate: int = 16000,
        channels: int = 1,
        chunk_size: int = 4096,
    ):
        self.sample_rate = sample_rate
        self.channels = channels
        self.chunk_size = chunk_size
        self._stream = None
        self._queue: asyncio.Queue[bytes] = asyncio.Queue(maxsize=100)

    async def start(self):
        """Start microphone capture."""
        try:
            import sounddevice as sd
            import numpy as np

            def callback(indata, frames, time, status):
                if status:
                    logger.warning(f"Audio status: {status}")
                # Convert float32 to int16 bytes
                audio_bytes = (indata * 32767).astype(np.int16).tobytes()
                try:
                    self._queue.put_nowait(audio_bytes)
                except asyncio.QueueFull:
                    pass  # Drop frames if queue is full

            self._stream = sd.InputStream(
                samplerate=self.sample_rate,
                channels=self.channels,
                dtype="float32",
                blocksize=self.chunk_size,
                callback=callback,
            )
            self._stream.start()
            logger.info("Microphone capture started")
        except ImportError:
            logger.error("sounddevice and numpy packages required: pip install sounddevice numpy")
            raise

    async def stop(self):
        """Stop microphone capture."""
        if self._stream:
            self._stream.stop()
            self._stream.close()
            self._stream = None
            logger.info("Microphone capture stopped")

    async def read(self) -> bytes | None:
        """Read audio data from microphone."""
        try:
            return await asyncio.wait_for(self._queue.get(), timeout=0.1)
        except asyncio.TimeoutError:
            return None


async def stream_audio_to_stt(
    stt: STTProvider,
    audio_capture: AudioCapture,
    stop_event: asyncio.Event | None = None,
):
    """Stream audio from capture device to STT provider.

    Args:
        stt: STT provider instance (must be connected)
        audio_capture: AudioCapture instance
        stop_event: Optional event to signal stop
    """
    await audio_capture.start()

    try:
        while not (stop_event and stop_event.is_set()):
            audio_data = await audio_capture.read()
            if audio_data:
                await stt.send_audio(audio_data)
            else:
                await asyncio.sleep(0.01)
    finally:
        await audio_capture.stop()
