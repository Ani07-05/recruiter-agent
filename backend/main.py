"""FastAPI application with WebSocket endpoint for real-time recruiter assistance."""

import json
import logging
import os
import uuid
from contextlib import asynccontextmanager
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Load environment variables from .env file
load_dotenv()

from agent import RecruiterAgent, RecruiterSession
from models import (
    SuggestedQuestion,
    JobSummary,
    SuggestionMessage,
    SummaryMessage,
    StateChangeMessage,
    ErrorMessage,
    CompletionStatus,
    CompletionStatusMessage,
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    logger.info("Starting Recruiter Agent Backend")
    yield
    logger.info("Shutting down Recruiter Agent Backend")


app = FastAPI(
    title="Recruiter Agent Backend",
    description="AI-powered assistant for recruiter calls with hiring managers",
    version="1.0.0",
    lifespan=lifespan,
)

# Add CORS middleware for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create the agent factory
agent = RecruiterAgent()


# ============ Agent Connection Manager ============

class ConnectionManager:
    """Manages WebSocket connections and their associated sessions."""

    def __init__(self):
        self.active_connections: dict[WebSocket, RecruiterSession] = {}

    async def connect(self, websocket: WebSocket) -> RecruiterSession:
        await websocket.accept()

        async def on_suggestion(suggestion: SuggestedQuestion):
            message = SuggestionMessage(data=suggestion)
            await self._send_json(websocket, message.model_dump())

        async def on_summary(summary: JobSummary):
            message = SummaryMessage(data=summary)
            await self._send_json(websocket, message.model_dump())

        async def on_state_change(state: str):
            message = StateChangeMessage(state=state)
            await self._send_json(websocket, message.model_dump())

        session = agent.create_session(
            on_suggestion=on_suggestion,
            on_summary=on_summary,
            on_state_change=on_state_change
        )

        self.active_connections[websocket] = session
        logger.info(f"New connection. Total: {len(self.active_connections)}")
        return session

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            del self.active_connections[websocket]
            logger.info(f"Connection closed. Total: {len(self.active_connections)}")

    async def _send_json(self, websocket: WebSocket, data: dict[str, Any]):
        try:
            await websocket.send_json(data)
        except Exception as e:
            logger.error(f"Error sending message: {e}")


manager = ConnectionManager()


# ============ Call Room Manager (WebRTC Signaling) ============

class CallRoom:
    """Represents a call room with participants."""
    def __init__(self, room_id: str):
        self.room_id = room_id
        self.participants: dict[str, WebSocket] = {}  # role -> websocket

    async def broadcast(self, message: dict, exclude_role: str | None = None):
        for role, ws in self.participants.items():
            if role != exclude_role:
                try:
                    await ws.send_json(message)
                except:
                    pass


class CallRoomManager:
    """Manages call rooms for WebRTC signaling."""

    def __init__(self):
        self.rooms: dict[str, CallRoom] = {}

    def create_room(self) -> str:
        room_id = str(uuid.uuid4())[:8]
        self.rooms[room_id] = CallRoom(room_id)
        logger.info(f"Created room: {room_id}")
        return room_id

    def get_room(self, room_id: str) -> CallRoom | None:
        return self.rooms.get(room_id)

    def get_or_create_room(self, room_id: str) -> CallRoom:
        if room_id not in self.rooms:
            self.rooms[room_id] = CallRoom(room_id)
        return self.rooms[room_id]

    async def join_room(self, room_id: str, role: str, websocket: WebSocket) -> CallRoom:
        room = self.get_or_create_room(room_id)

        # Notify existing participants
        if room.participants:
            await room.broadcast({"type": "peer_joined", "role": role})

        room.participants[role] = websocket

        # Notify the new participant about existing peers
        for existing_role in room.participants:
            if existing_role != role:
                await websocket.send_json({"type": "peer_joined", "role": existing_role})

        logger.info(f"Room {room_id}: {role} joined. Participants: {list(room.participants.keys())}")
        return room

    async def leave_room(self, room_id: str, role: str):
        room = self.get_room(room_id)
        if room and role in room.participants:
            del room.participants[role]
            await room.broadcast({"type": "peer_left", "role": role})
            logger.info(f"Room {room_id}: {role} left")

            # Clean up empty rooms
            if not room.participants:
                del self.rooms[room_id]
                logger.info(f"Room {room_id} deleted (empty)")


call_manager = CallRoomManager()


# ============ API Endpoints ============

@app.get("/")
async def root():
    return {"status": "ok", "service": "recruiter-agent-backend"}


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "active_connections": len(manager.active_connections),
        "active_rooms": len(call_manager.rooms)
    }


class CreateRoomResponse(BaseModel):
    room_id: str
    join_url: str


@app.post("/api/rooms", response_model=CreateRoomResponse)
async def create_room():
    """Create a new call room."""
    room_id = call_manager.create_room()
    return CreateRoomResponse(
        room_id=room_id,
        join_url=f"/call/{room_id}"
    )


@app.get("/api/rooms/{room_id}")
async def get_room(room_id: str):
    """Get room info."""
    room = call_manager.get_room(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return {
        "room_id": room_id,
        "participants": list(room.participants.keys())
    }


@app.get("/api/config")
async def get_config():
    """Get public configuration (like Deepgram key for client-side transcription)."""
    return {
        "deepgram_api_key": os.environ.get("DEEPGRAM_API_KEY", "")
    }


# ============ WebSocket Endpoints ============

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for AI agent communication."""
    session = await manager.connect(websocket)

    try:
        while True:
            data = await websocket.receive_json()
            message_type = data.get("type")

            if message_type == "transcript":
                text = data.get("text", "")
                speaker = data.get("speaker")
                is_final = data.get("is_final", True)

                if text.strip():
                    logger.info(f"Processing: [{speaker}] {text[:50]}...")
                    try:
                        await session.process_transcript(text, speaker, is_final=is_final)
                    except Exception as e:
                        logger.error(f"Error processing transcript: {e}", exc_info=True)
                        await websocket.send_json(ErrorMessage(
                            message=str(e),
                            code="PROCESSING_ERROR"
                        ).model_dump())

            elif message_type == "question_shown":
                # Frontend confirms question was displayed to recruiter
                try:
                    await session.notify_question_shown()
                except Exception as e:
                    logger.error(f"Error in question_shown: {e}")

            elif message_type == "generate_question":
                # Manual question generation requested
                logger.info("Manual question generation requested")
                try:
                    await session.generate_question_on_demand()
                except Exception as e:
                    logger.error(f"Error generating question: {e}", exc_info=True)
                    await websocket.send_json(ErrorMessage(
                        message=str(e),
                        code="GENERATION_ERROR"
                    ).model_dump())

            elif message_type == "get_completion_status":
                # Get completion status for call tracking
                try:
                    status_data = session.get_completion_status()
                    status = CompletionStatus(**status_data)
                    message = CompletionStatusMessage(data=status)
                    await websocket.send_json(message.model_dump())
                except Exception as e:
                    logger.error(f"Error getting completion status: {e}", exc_info=True)
                    await websocket.send_json(ErrorMessage(
                        message=str(e),
                        code="STATUS_ERROR"
                    ).model_dump())

            elif message_type == "end_call":
                logger.info("End call received, generating summary...")
                try:
                    summary = await session.generate_summary()
                    if not summary:
                        await websocket.send_json(ErrorMessage(
                            message="Could not generate summary",
                            code="SUMMARY_ERROR"
                        ).model_dump())
                except Exception as e:
                    logger.error(f"Error generating summary: {e}")
                    await websocket.send_json(ErrorMessage(
                        message=str(e),
                        code="SUMMARY_ERROR"
                    ).model_dump())

            elif message_type == "clear":
                session.clear()
                await websocket.send_json({"type": "cleared"})

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)


@app.websocket("/call/{room_id}")
async def call_signaling_endpoint(websocket: WebSocket, room_id: str):
    """WebSocket endpoint for WebRTC signaling."""
    await websocket.accept()
    role = None

    try:
        while True:
            data = await websocket.receive_json()
            message_type = data.get("type")

            if message_type == "join":
                role = data.get("role", "unknown")
                room = await call_manager.join_room(room_id, role, websocket)

            elif message_type in ["offer", "answer", "ice_candidate"]:
                room = call_manager.get_room(room_id)
                if room:
                    # Forward to other participants
                    await room.broadcast(data, exclude_role=role)

    except WebSocketDisconnect:
        if role:
            await call_manager.leave_room(room_id, role)
    except Exception as e:
        logger.error(f"Call signaling error: {e}")
        if role:
            await call_manager.leave_room(room_id, role)


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
