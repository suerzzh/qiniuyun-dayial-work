from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Any

import aiohttp


DASHSCOPE_TOKEN_ENDPOINT = "https://dashscope.aliyuncs.com/api/v1/tokens"
MIN_TTL_SECONDS = 1
MAX_TTL_SECONDS = 1800


class TemporaryApiKeyError(RuntimeError):
    """Raised when DashScope cannot issue a usable temporary API key."""


@dataclass(frozen=True)
class TemporaryApiKey:
    token: str = field(repr=False)
    expires_at: int | float


@dataclass(frozen=True)
class RealtimeApiCredential:
    token: str = field(repr=False)
    mode: str
    expires_at: int | float | None


async def issue_temporary_api_key(
    client: aiohttp.ClientSession,
    *,
    permanent_api_key: str,
    ttl_seconds: int,
    ssl_context: Any = None,
    token_endpoint: str = DASHSCOPE_TOKEN_ENDPOINT,
) -> TemporaryApiKey:
    """Issue a short-lived DashScope key without exposing either credential."""
    if not permanent_api_key.strip():
        raise ValueError("permanent API key is required")
    if not MIN_TTL_SECONDS <= ttl_seconds <= MAX_TTL_SECONDS:
        raise ValueError("temporary API key TTL must be between 1 and 1800 seconds")

    try:
        async with client.post(
            token_endpoint,
            params={"expire_in_seconds": str(ttl_seconds)},
            headers={"Authorization": f"Bearer {permanent_api_key}"},
            ssl=ssl_context,
        ) as response:
            if response.status < 200 or response.status >= 300:
                raise TemporaryApiKeyError(
                    "temporary API key request failed with status "
                    f"{response.status}"
                )
            try:
                payload = await response.json(content_type=None)
            except (ValueError, aiohttp.ContentTypeError) as exc:
                raise TemporaryApiKeyError(
                    "temporary API key response is not valid JSON"
                ) from exc
    except TemporaryApiKeyError:
        raise
    except (aiohttp.ClientError, asyncio.TimeoutError) as exc:
        raise TemporaryApiKeyError(
            "temporary API key request failed"
        ) from exc

    if not isinstance(payload, dict):
        raise TemporaryApiKeyError(
            "temporary API key response must be a JSON object"
        )
    token = payload.get("token")
    if not isinstance(token, str) or not token.strip():
        raise TemporaryApiKeyError(
            "temporary API key response is missing token"
        )
    expires_at = payload.get("expires_at")
    if not isinstance(expires_at, (int, float)):
        raise TemporaryApiKeyError(
            "temporary API key response is missing expires_at"
        )

    return TemporaryApiKey(token=token, expires_at=expires_at)


async def resolve_realtime_api_key(
    client: aiohttp.ClientSession,
    *,
    permanent_api_key: str,
    use_temporary_key: bool,
    ttl_seconds: int,
    ssl_context: Any = None,
    token_endpoint: str = DASHSCOPE_TOKEN_ENDPOINT,
) -> RealtimeApiCredential:
    """Resolve the credential used for one Realtime SDP exchange."""
    if not permanent_api_key.strip():
        raise ValueError("permanent API key is required")
    if not use_temporary_key:
        return RealtimeApiCredential(
            token=permanent_api_key,
            mode="permanent",
            expires_at=None,
        )

    temporary_key = await issue_temporary_api_key(
        client,
        permanent_api_key=permanent_api_key,
        ttl_seconds=ttl_seconds,
        ssl_context=ssl_context,
        token_endpoint=token_endpoint,
    )
    return RealtimeApiCredential(
        token=temporary_key.token,
        mode="temporary",
        expires_at=temporary_key.expires_at,
    )
