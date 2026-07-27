from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import ssl
import uuid
from pathlib import Path
from typing import Any

import aiohttp
import certifi
from aiohttp import web

try:
    from .business_logic import (
        JsonConversationStore,
        RealtimeBusinessLogic,
        SessionState,
        utc_now,
    )
    from .latency_report import MarkdownLatencyReport
    from .session_identity import (
        bind_provider_session_id,
        write_session_identity_record,
    )
    from .temporary_key import (
        TemporaryApiKeyError,
        resolve_realtime_api_key,
    )
except ImportError:
    from business_logic import (
        JsonConversationStore,
        RealtimeBusinessLogic,
        SessionState,
        utc_now,
    )
    from latency_report import MarkdownLatencyReport
    from session_identity import (
        bind_provider_session_id,
        write_session_identity_record,
    )
    from temporary_key import (
        TemporaryApiKeyError,
        resolve_realtime_api_key,
    )


ROOT_DIR = Path(__file__).resolve().parents[1]
MAX_SDP_BYTES = 1024 * 1024
WORKSPACE_PATTERN = re.compile(r"^[A-Za-z0-9_-]{3,128}$")


def load_dotenv(path: Path) -> None:
    """Load simple KEY=VALUE entries without another dependency."""
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key.strip(), value)


# Prefer the conventional project-root file. The VS Code-local location is
# supported as a fallback for this workspace's current setup.
load_dotenv(ROOT_DIR / ".env")
load_dotenv(ROOT_DIR / ".vscode" / ".env")

API_KEY = os.getenv("DASHSCOPE_API_KEY", "")
WORKSPACE_ID = os.getenv("BAILIAN_WORKSPACE_ID", "")
MODEL = os.getenv("BAILIAN_MODEL", "qwen3.5-omni-plus-realtime")
USE_TEMPORARY_API_KEY = os.getenv(
    "DASHSCOPE_USE_TEMP_KEY", "false"
).strip().lower() in {"1", "true", "yes", "on"}
TEMPORARY_API_KEY_TTL_SECONDS = int(
    os.getenv("DASHSCOPE_TEMP_KEY_TTL_SECONDS", "600")
)
VAD_SILENCE_DURATION_MS = int(
    os.getenv("VAD_SILENCE_DURATION_MS", "800")
)
IDLE_TIMEOUT_MS = int(os.getenv("IDLE_TIMEOUT_MS", "0"))
HOST = os.getenv("BACKEND_HOST", "127.0.0.1")
PORT = int(os.getenv("BACKEND_PORT", "8000"))
DEMO_USER_ID = os.getenv("DEMO_USER_ID", "demo-user-001").strip()
BASE_PROMPT = os.getenv(
    "BASE_SYSTEM_PROMPT",
    "",
)
_profile_file_setting = Path(
    os.getenv(
        "LEARNER_PROFILE_FILE",
        os.getenv("CONVERSATION_MEMORY_FILE", "data/conversations.json"),
    )
)
PROFILE_FILE = (
    _profile_file_setting
    if _profile_file_setting.is_absolute()
    else ROOT_DIR / _profile_file_setting
)
_latency_file_setting = Path(
    os.getenv("LATENCY_REPORT_FILE", "data/latency_report.md")
)
LATENCY_REPORT_FILE = (
    _latency_file_setting
    if _latency_file_setting.is_absolute()
    else ROOT_DIR / _latency_file_setting
)
_identity_output_setting = Path(
    os.getenv(
        "SESSION_IDENTITY_OUTPUT_FILE",
        "data/last_session_identity.txt",
    )
)
IDENTITY_OUTPUT_FILE = (
    _identity_output_setting
    if _identity_output_setting.is_absolute()
    else ROOT_DIR / _identity_output_setting
)
ALLOWED_ORIGINS = {
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "http://127.0.0.1:8080,http://localhost:8080",
    ).split(",")
    if origin.strip()
}


@web.middleware
async def error_middleware(
    request: web.Request, handler: Any
) -> web.StreamResponse:
    try:
        return await handler(request)
    except web.HTTPException as exc:
        try:
            payload = json.loads(exc.text)
        except (TypeError, json.JSONDecodeError):
            payload = {"error": exc.reason}
        return web.json_response(payload, status=exc.status)
    except ValueError as exc:
        return web.json_response({"error": str(exc)}, status=400)
    except asyncio.TimeoutError:
        return web.json_response(
            {"error": "Upstream request timed out"}, status=504
        )
    except Exception:
        request.app["logger"].exception("Unhandled request error")
        return web.json_response(
            {"error": "Internal server error"}, status=500
        )


@web.middleware
async def cors_middleware(
    request: web.Request, handler: Any
) -> web.StreamResponse:
    origin = request.headers.get("Origin")
    response = (
        web.Response(status=204)
        if request.method == "OPTIONS"
        else await handler(request)
    )
    if origin and origin in ALLOWED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Vary"] = "Origin"
        response.headers["Access-Control-Allow-Methods"] = (
            "GET, POST, DELETE, OPTIONS"
        )
        response.headers["Access-Control-Allow-Headers"] = "Content-Type"
        response.headers["Access-Control-Max-Age"] = "600"
    return response


def get_session(request: web.Request) -> SessionState:
    session_id = request.match_info.get("session_id") or request.query.get(
        "session_id", ""
    )
    session = request.app["sessions"].get(session_id)
    if session is None:
        raise web.HTTPNotFound(
            text=json.dumps({"error": "Session not found"}),
            content_type="application/json",
        )
    return session


async def health(request: web.Request) -> web.Response:
    return web.json_response(
        {
            "status": "ok",
            "api_key_configured": bool(API_KEY),
            "workspace_configured": bool(WORKSPACE_ID),
            "credential_mode": (
                "temporary" if USE_TEMPORARY_API_KEY else "permanent"
            ),
            "temporary_key_ttl_seconds": (
                TEMPORARY_API_KEY_TTL_SECONDS
                if USE_TEMPORARY_API_KEY
                else None
            ),
        }
    )


async def index(request: web.Request) -> web.Response:
    return web.json_response(
        {
            "service": "WebRTC Realtime Python backend",
            "status": "running",
            "health": "/health",
            "frontend": "http://127.0.0.1:8080/webrtc_demo.html",
        }
    )


async def create_session(request: web.Request) -> web.Response:
    body = await request.json()
    prompt = request.app["business"].validate_prompt(body.get("prompt", ""))
    raw_conversation_id = body.get("conversation_id")
    conversation_id = (
        str(raw_conversation_id).strip()
        if raw_conversation_id is not None
        else ""
    )
    if conversation_id and not re.fullmatch(
        r"[A-Za-z0-9_-]{8,64}", conversation_id
    ):
        raise ValueError("conversation_id is invalid")
    if not conversation_id:
        conversation_id = uuid.uuid4().hex

    store = request.app["profile_store"]
    store.ensure_conversation(conversation_id)
    learner_profile = store.get_learner_profile(conversation_id)
    session_id = uuid.uuid4().hex
    session = SessionState(
        session_id=session_id,
        conversation_id=conversation_id,
        user_id=request.app["demo_user_id"],
        user_prompt=prompt,
        learner_level=learner_profile["level"],
        learner_level_label=learner_profile["label"],
    )
    request.app["sessions"][session_id] = session
    return web.json_response(
        {
            "session_id": session_id,
            "conversation_id": conversation_id,
            "user_id": session.user_id,
            "created_at": session.created_at,
            "history": [],
            "learner_profile": learner_profile,
            "session_config": request.app["business"].build_session_config(
                session
            ),
        },
        status=201,
    )


async def get_session_config(request: web.Request) -> web.Response:
    session = get_session(request)
    return web.json_response(
        {
            "session_id": session.session_id,
            "session_config": request.app["business"].build_session_config(
                session
            ),
        }
    )


async def remember_event(request: web.Request) -> web.Response:
    session = get_session(request)
    body = await request.json()
    message = request.app["business"].message_from_event(body.get("event"))
    stored = False
    if message:
        source_id = message.get("source_id")
        duplicate = source_id and any(
            existing.get("source_id") == source_id
            and existing.get("role") == message.get("role")
            for existing in session.turn_messages
        )
        if not duplicate:
            session.turn_messages.append(message)
            if message.get("role") == "user":
                session.learner_turns_since_review += 1
            stored = True
    return web.json_response(
        {
            "stored": stored,
            "message": message,
            "session_message_count": len(session.turn_messages),
            "learner_turns_since_review": session.learner_turns_since_review,
        },
        status=201,
    )


async def update_learner_level(request: web.Request) -> web.Response:
    session = get_session(request)
    body = await request.json()
    arguments = body.get("arguments", {})
    if not isinstance(arguments, dict):
        raise ValueError("arguments must be an object")
    try:
        requested_level = int(arguments.get("requested_level"))
    except (TypeError, ValueError):
        raise ValueError("requested_level must be an integer")
    if not 1 <= requested_level <= 6:
        raise ValueError("requested_level must be between 1 and 6")
    reason = str(arguments.get("reason", "")).strip()
    if not reason:
        raise ValueError("reason is required")

    profile = request.app["profile_store"].get_learner_profile(
        session.conversation_id
    )
    current_level = int(profile["level"])
    if session.learner_turns_since_review < 3:
        return web.json_response(
            {
                "applied": False,
                "reason": "At least three learner turns are required",
                "required_turns_remaining": (
                    3 - session.learner_turns_since_review
                ),
                "learner_profile": profile,
            }
        )

    bounded_level = max(
        current_level - 1, min(current_level + 1, requested_level)
    )
    updated_profile = request.app["profile_store"].save_learner_profile(
        session.conversation_id, bounded_level, reason
    )
    session.learner_level = bounded_level
    session.learner_level_label = updated_profile["label"]
    session.learner_turns_since_review = 0
    return web.json_response(
        {
            "applied": bounded_level != current_level,
            "requested_level": requested_level,
            "applied_level": bounded_level,
            "bounded_to_one_step": bounded_level != requested_level,
            "learner_profile": updated_profile,
        }
    )


async def record_latency(request: web.Request) -> web.Response:
    session = get_session(request)
    metric = await request.json()
    if not isinstance(metric, dict):
        raise ValueError("latency metric must be an object")
    request.app["latency_report"].append(
        conversation_id=session.conversation_id,
        session_id=session.session_id,
        learner_level_label=session.learner_level_label,
        metric=metric,
    )
    return web.json_response({"recorded": True}, status=201)


async def record_session_quality(request: web.Request) -> web.Response:
    session = get_session(request)
    metric = await request.json()
    if not isinstance(metric, dict):
        raise ValueError("session quality metric must be an object")
    request.app["latency_report"].append_session(
        conversation_id=session.conversation_id,
        session_id=session.session_id,
        metric=metric,
    )
    return web.json_response({"recorded": True}, status=201)


async def get_latency_report(request: web.Request) -> web.Response:
    return web.Response(
        text=request.app["latency_report"].read(),
        content_type="text/markdown",
    )


async def get_profile(request: web.Request) -> web.Response:
    session = get_session(request)
    return web.json_response(
        {
            "session_id": session.session_id,
            "conversation_id": session.conversation_id,
            "current_session_messages": list(session.turn_messages),
            "learner_profile": {
                "level": session.learner_level,
                "label": session.learner_level_label,
                "turns_since_review": session.learner_turns_since_review,
            },
        }
    )


async def bind_provider_session(request: web.Request) -> web.Response:
    session = get_session(request)
    body = await request.json()
    provider_session_id = bind_provider_session_id(
        session, body.get("provider_session_id")
    )
    request.app["logger"].info(
        "Bound provider session %s to local session %s and user %s",
        provider_session_id,
        session.session_id,
        session.user_id,
    )
    return web.json_response(
        {
            "bound": True,
            "session_id": session.session_id,
            "user_id": session.user_id,
            "provider_session_id": provider_session_id,
        }
    )


async def delete_session(request: web.Request) -> web.Response:
    session = get_session(request)
    record = write_session_identity_record(
        request.app["identity_output_file"],
        session,
        ended_at=utc_now(),
    )
    request.app["sessions"].pop(session.session_id, None)
    request.app["logger"].info(
        "Session identity record written to %s",
        request.app["identity_output_file"],
    )
    return web.json_response(
        {
            "closed": True,
            "identity_record": record,
            "identity_record_file": str(
                request.app["identity_output_file"]
            ),
        }
    )


async def delete_conversation(request: web.Request) -> web.Response:
    conversation_id = request.match_info["conversation_id"]
    removed = request.app["profile_store"].delete_conversation(conversation_id)
    if not removed:
        raise web.HTTPNotFound(
            text=json.dumps({"error": "Conversation not found"}),
            content_type="application/json",
        )
    return web.Response(status=204)


async def realtime_proxy(request: web.Request) -> web.Response:
    get_session(request)
    if not API_KEY:
        return web.json_response(
            {"error": "DASHSCOPE_API_KEY is not configured"}, status=503
        )
    if not WORKSPACE_PATTERN.fullmatch(WORKSPACE_ID):
        return web.json_response(
            {"error": "BAILIAN_WORKSPACE_ID is not configured or invalid"},
            status=503,
        )
    if request.content_length and request.content_length > MAX_SDP_BYTES:
        return web.json_response({"error": "SDP body is too large"}, status=413)

    offer_sdp = await request.read()
    if not offer_sdp or len(offer_sdp) > MAX_SDP_BYTES:
        return web.json_response({"error": "Invalid SDP body"}, status=400)

    upstream_url = (
        f"https://{WORKSPACE_ID}.cn-beijing.maas.aliyuncs.com"
        f"/api/v1/webrtc/realtime?model={MODEL}"
    )
    ssl_context = ssl.create_default_context(cafile=certifi.where())
    timeout = aiohttp.ClientTimeout(total=15)
    async with aiohttp.ClientSession(timeout=timeout) as client:
        try:
            credential = await resolve_realtime_api_key(
                client,
                permanent_api_key=API_KEY,
                use_temporary_key=USE_TEMPORARY_API_KEY,
                ttl_seconds=TEMPORARY_API_KEY_TTL_SECONDS,
                ssl_context=ssl_context,
            )
        except (TemporaryApiKeyError, ValueError) as exc:
            request.app["logger"].warning(
                "Unable to prepare Realtime credential: %s", exc
            )
            return web.json_response({"error": str(exc)}, status=502)

        if credential.mode == "temporary":
            request.app["logger"].info(
                "Temporary DashScope API key issued for session %s; "
                "expires_at=%s",
                request.query.get("session_id", ""),
                credential.expires_at,
            )

        async with client.post(
            upstream_url,
            ssl=ssl_context,
            data=offer_sdp,
            headers={
                "Authorization": f"Bearer {credential.token}",
                "Content-Type": "application/sdp",
            },
        ) as upstream:
            answer = await upstream.read()
            return web.Response(
                body=answer,
                status=upstream.status,
                content_type=upstream.content_type or "application/sdp",
                headers={"Cache-Control": "no-store"},
            )


def create_app() -> web.Application:
    app = web.Application(
        middlewares=[cors_middleware, error_middleware],
        client_max_size=MAX_SDP_BYTES,
    )
    app["sessions"] = {}
    app["business"] = RealtimeBusinessLogic(
        BASE_PROMPT,
        vad_silence_duration_ms=VAD_SILENCE_DURATION_MS,
        idle_timeout_ms=IDLE_TIMEOUT_MS,
    )
    app["profile_store"] = JsonConversationStore(PROFILE_FILE)
    app["latency_report"] = MarkdownLatencyReport(LATENCY_REPORT_FILE)
    app["demo_user_id"] = DEMO_USER_ID or "demo-user-001"
    app["identity_output_file"] = IDENTITY_OUTPUT_FILE
    app["logger"] = logging.getLogger("webrtc-backend")
    app.add_routes(
        [
            web.get("/", index),
            web.get("/health", health),
            web.post("/api/sessions", create_session),
            web.get(
                "/api/sessions/{session_id}/config", get_session_config
            ),
            web.post(
                "/api/sessions/{session_id}/events", remember_event
            ),
            web.post(
                "/api/sessions/{session_id}/tools/learner-level",
                update_learner_level,
            ),
            web.post(
                "/api/sessions/{session_id}/latency", record_latency
            ),
            web.post(
                "/api/sessions/{session_id}/quality",
                record_session_quality,
            ),
            web.get("/api/sessions/{session_id}/profile", get_profile),
            web.post(
                "/api/sessions/{session_id}/provider-session",
                bind_provider_session,
            ),
            web.delete("/api/sessions/{session_id}", delete_session),
            web.delete(
                "/api/conversations/{conversation_id}", delete_conversation
            ),
            web.post("/api/realtime", realtime_proxy),
            web.get("/api/latency-report", get_latency_report),
            web.options("/{path:.*}", lambda request: web.Response(status=204)),
        ]
    )
    return app


if __name__ == "__main__":
    logging.basicConfig(
        level=os.getenv("LOG_LEVEL", "INFO").upper(),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    web.run_app(create_app(), host=HOST, port=PORT)
