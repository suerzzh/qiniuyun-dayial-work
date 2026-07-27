from __future__ import annotations

import re
from pathlib import Path
from typing import Any


PROVIDER_SESSION_ID_PATTERN = re.compile(r"^sess_[A-Za-z0-9_-]{12,128}$")


def validate_provider_session_id(value: object) -> str:
    if not isinstance(value, str):
        raise ValueError("provider_session_id is invalid")
    provider_session_id = value.strip()
    if not PROVIDER_SESSION_ID_PATTERN.fullmatch(provider_session_id):
        raise ValueError("provider_session_id is invalid")
    return provider_session_id


def bind_provider_session_id(session: Any, value: object) -> str:
    provider_session_id = validate_provider_session_id(value)
    current = getattr(session, "provider_session_id", None)
    if current and current != provider_session_id:
        raise ValueError("session is already bound to another provider_session_id")
    session.provider_session_id = provider_session_id
    return provider_session_id


def write_session_identity_record(
    output_path: Path,
    session: Any,
    *,
    ended_at: str,
) -> dict[str, str]:
    provider_session_id = (
        session.provider_session_id or "NOT_CAPTURED"
    )
    record = {
        "user_id": str(session.user_id),
        "local_session_id": str(session.session_id),
        "provider_session_id": provider_session_id,
        "cloud_comparison_field": "task_uuid",
        "capture_status": (
            "captured" if session.provider_session_id else "missing"
        ),
        "started_at": str(session.created_at),
        "ended_at": ended_at,
    }
    lines = [
        "UniSpeaking local session identity validation",
        "",
        *(f"{key}: {value}" for key, value in record.items()),
        "",
        "Compare provider_session_id above with task_uuid in the Qwen cloud JSON.",
    ]
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return record
