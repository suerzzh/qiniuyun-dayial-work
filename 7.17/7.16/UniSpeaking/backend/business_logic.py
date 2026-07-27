from __future__ import annotations

import json
import os
import threading
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


MAX_PROMPT_LENGTH = 2000
MAX_SESSION_MESSAGES = 200
DEFAULT_LEARNER_LEVEL = 4
LEVEL_LABELS = {
    1: "Starter (A1)",
    2: "Basic (A2)",
    3: "Intermediate (B1)",
    4: "CET-4 (B1-B2)",
    5: "CET-6 (B2)",
    6: "Advanced (C1)",
}

CLARA_PROMPT_FILE = Path(__file__).with_name("clara_current_en.txt")


def load_clara_system_prompt() -> str:
    try:
        prompt = CLARA_PROMPT_FILE.read_text(encoding="utf-8").strip()
    except OSError as exc:
        raise RuntimeError("Clara system prompt file is unavailable") from exc
    if not prompt:
        raise RuntimeError("Clara system prompt file is empty")
    return prompt


ENGLISH_COACH_SYSTEM_PROMPT = load_clara_system_prompt()


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class SessionState:
    session_id: str
    conversation_id: str
    user_id: str
    user_prompt: str
    learner_level: int = DEFAULT_LEARNER_LEVEL
    learner_level_label: str = LEVEL_LABELS[DEFAULT_LEARNER_LEVEL]
    learner_turns_since_review: int = 0
    provider_session_id: str | None = None
    created_at: str = field(default_factory=utc_now)
    turn_messages: deque[dict[str, Any]] = field(
        default_factory=lambda: deque(maxlen=MAX_SESSION_MESSAGES)
    )


class JsonConversationStore:
    """Small JSON persistence layer for learner profile data."""

    def __init__(self, path: Path):
        self.path = path
        self._lock = threading.RLock()
        self._data = self._load()

    def _load(self) -> dict[str, Any]:
        if not self.path.exists():
            return {"version": 1, "conversations": {}}
        try:
            data = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return {"version": 1, "conversations": {}}
        if not isinstance(data, dict) or not isinstance(
            data.get("conversations"), dict
        ):
            return {"version": 1, "conversations": {}}
        for conversation in data["conversations"].values():
            if isinstance(conversation, dict):
                # Drop long-term memory fields created by older versions. The
                # current app keeps only learner profile data in this file.
                conversation.pop("summary", None)
                conversation.pop("messages", None)
        return data

    def _save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temp_path = self.path.with_suffix(self.path.suffix + ".tmp")
        temp_path.write_text(
            json.dumps(self._data, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        os.replace(temp_path, self.path)

    def get_learner_profile(self, conversation_id: str) -> dict[str, Any]:
        with self._lock:
            conversation = self._data["conversations"].get(conversation_id, {})
            profile = conversation.get("learner_profile", {})
            try:
                level = int(profile.get("level", DEFAULT_LEARNER_LEVEL))
            except (TypeError, ValueError):
                level = DEFAULT_LEARNER_LEVEL
            level = max(1, min(6, level))
            return {
                "level": level,
                "label": LEVEL_LABELS[level],
                "last_reason": str(profile.get("last_reason", ""))[:1000],
                "updated_at": profile.get("updated_at"),
            }

    def ensure_conversation(self, conversation_id: str) -> None:
        with self._lock:
            conversations = self._data["conversations"]
            if conversation_id in conversations:
                return
            now = utc_now()
            conversations[conversation_id] = {
                "created_at": now,
                "updated_at": now,
                "learner_profile": {
                    "level": DEFAULT_LEARNER_LEVEL,
                    "label": LEVEL_LABELS[DEFAULT_LEARNER_LEVEL],
                    "last_reason": "Default starting level",
                    "updated_at": now,
                },
            }
            self._save()

    def save_learner_profile(
        self, conversation_id: str, level: int, reason: str
    ) -> dict[str, Any]:
        level = max(1, min(6, int(level)))
        with self._lock:
            self.ensure_conversation(conversation_id)
            profile = {
                "level": level,
                "label": LEVEL_LABELS[level],
                "last_reason": reason.strip()[:1000],
                "updated_at": utc_now(),
            }
            conversation = self._data["conversations"][conversation_id]
            conversation["learner_profile"] = profile
            conversation["updated_at"] = profile["updated_at"]
            self._save()
            return dict(profile)

    def delete_conversation(self, conversation_id: str) -> bool:
        with self._lock:
            removed = (
                self._data["conversations"].pop(conversation_id, None)
                is not None
            )
            if removed:
                self._save()
            return removed


class RealtimeBusinessLogic:
    """English-coach prompt, event normalization, and learner profile logic."""

    def __init__(
        self,
        extra_base_prompt: str = "",
        vad_silence_duration_ms: int = 800,
        idle_timeout_ms: int = 0,
    ):
        self.extra_base_prompt = extra_base_prompt.strip()
        self.vad_silence_duration_ms = vad_silence_duration_ms
        self.idle_timeout_ms = idle_timeout_ms

    def validate_prompt(self, prompt: Any) -> str:
        if not isinstance(prompt, str):
            raise ValueError("prompt must be a string")
        prompt = prompt.strip()
        if len(prompt) > MAX_PROMPT_LENGTH:
            raise ValueError(
                f"prompt cannot exceed {MAX_PROMPT_LENGTH} characters"
            )
        return prompt

    def build_instructions(self, session: SessionState) -> str:
        parts = [ENGLISH_COACH_SYSTEM_PROMPT]
        parts.append(
            "Adaptive language level:\n"
            f"The learner's current level is {session.learner_level}: "
            f"{session.learner_level_label}. Use vocabulary and sentence "
            "structures appropriate for this level. Level 4 means ordinary "
            "CET-4 vocabulary and is the default. Do not change difficulty "
            "because of one unusual answer. Evaluate a pattern across at least "
            "three learner turns. Consistent confused, fragmented, heavily "
            "Chinese-mixed, or highly hesitant answers support lowering one "
            "level. Consistent fluent, accurate, detailed answers support "
            "raising one level. When there is enough multi-turn evidence, call "
            "update_learner_level. Never request a jump of more than one level. "
            "Do not announce the internal numeric level unless the learner asks."
        )
        if self.extra_base_prompt:
            parts.append(f"Application rules:\n{self.extra_base_prompt}")
        if session.user_prompt:
            parts.append(f"Lesson focus:\n{session.user_prompt}")

        return "\n\n".join(parts)

    def build_session_config(self, session: SessionState) -> dict[str, Any]:
        turn_detection: dict[str, Any] = {
            "prefix_padding_ms": 500,
            "silence_duration_ms": self.vad_silence_duration_ms,
            "threshold": 0.5,
            "type": "server_vad",
        }
        # An automatic idle response can race with a normal response and create
        # an assistant-only turn. Keep it opt-in; server VAD still responds
        # normally after the learner finishes an utterance.
        if self.idle_timeout_ms > 0:
            turn_detection["idle_timeout_ms"] = self.idle_timeout_ms

        return {
            "voice": "Tina",
            "input_audio_format": "pcm",
            "input_audio_transcription": {
                "model": "qwen3-asr-flash-realtime"
            },
            "instructions": self.build_instructions(session),
            "modalities": ["text", "audio"],
            "output_audio_format": "pcm",
            "max_tokens": 128,
            "temperature": 0.7,
            "tools": [
                {
                    "type": "function",
                    "function": {
                        "name": "update_learner_level",
                        "description": (
                            "Update the learner's persistent English level only "
                            "after at least three learner turns show a consistent "
                            "pattern. Use lower levels for fragmented, highly "
                            "hesitant, Chinese-mixed speech; higher levels for "
                            "consistently fluent, accurate, detailed speech."
                        ),
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "requested_level": {
                                    "type": "integer",
                                    "minimum": 1,
                                    "maximum": 6,
                                    "description": (
                                        "Recommended level. It must differ from "
                                        "the current level by no more than one."
                                    ),
                                },
                                "reason": {
                                    "type": "string",
                                    "description": (
                                        "Brief evidence based on multiple recent "
                                        "learner turns."
                                    ),
                                },
                            },
                            "required": ["requested_level", "reason"],
                        },
                    },
                }
            ],
            "turn_detection": turn_detection,
        }

    def message_from_event(
        self, event: Any
    ) -> dict[str, Any] | None:
        if not isinstance(event, dict):
            raise ValueError("event must be an object")

        event_type = str(event.get("type", ""))
        role = ""
        text = ""
        source_id = ""

        if event_type == (
            "conversation.item.input_audio_transcription.completed"
        ):
            role = "user"
            text = str(event.get("transcript", "")).strip()
            source_id = str(event.get("item_id", ""))
        elif event_type == "response.audio_transcript.done":
            role = "assistant"
            text = str(event.get("transcript", "")).strip()
            source_id = str(
                event.get("item_id") or event.get("response_id") or ""
            )
        elif event_type == "response.text.done":
            role = "assistant"
            text = str(event.get("text", "")).strip()
            source_id = str(
                event.get("item_id") or event.get("response_id") or ""
            )

        if not role or not text:
            return None
        return {
            "role": role,
            "text": text[:8000],
            "timestamp": utc_now(),
            "source_id": source_id[:128],
        }
