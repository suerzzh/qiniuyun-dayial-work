# Local DashScope Temporary API Key Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the local Python WebRTC Demo mint and use a 600-second DashScope temporary API key for every new SDP exchange.

**Architecture:** A focused `backend/temporary_key.py` module owns token issuance and validation. `backend/app.py` selects permanent or temporary credential mode from local environment variables, uses the issued token only for the upstream SDP call, and never exposes either key to the browser.

**Tech Stack:** Python 3.11, aiohttp 3.x, unittest, DashScope token API.

## Global Constraints

- Do not modify Vercel or remote Supabase configuration.
- Do not log, return, commit, or copy API key values.
- Temporary key TTL is 600 seconds and must remain within the official 1–1800 second range.
- Temporary-key issuance failures must not silently fall back to the permanent key.

---

### Task 1: Temporary-key issuer

**Files:**
- Create: `7.14/UniSpeaking/backend/temporary_key.py`
- Create: `7.14/UniSpeaking/tests/test_temporary_key.py`

**Interfaces:**
- Produces: `TemporaryApiKey(token: str, expires_at: int | float)` and `issue_temporary_api_key(client, permanent_api_key, ttl_seconds, ssl_context=None, token_endpoint=...)`.

- [x] Write async tests using an aiohttp `TestServer` for a successful 600-second request, invalid TTL, non-200 response, and missing token.
- [x] Run `python -m unittest tests.test_temporary_key -v` and confirm failure because the module does not exist.
- [x] Implement the minimum issuer with Bearer authentication, query parameter `expire_in_seconds=600`, JSON validation, and sanitized errors.
- [x] Re-run the focused test and confirm all cases pass.

### Task 2: Local Realtime proxy integration

**Files:**
- Modify: `7.14/UniSpeaking/backend/app.py`
- Modify: `7.14/UniSpeaking/.env`
- Modify: `7.14/UniSpeaking/.env.example`

**Interfaces:**
- Consumes: `issue_temporary_api_key(...)` from Task 1.
- Produces: `DASHSCOPE_USE_TEMP_KEY` feature switch and `DASHSCOPE_TEMP_KEY_TTL_SECONDS` configuration.

- [x] Add configuration parsing with permanent mode as the code fallback.
- [x] In `realtime_proxy`, issue a temporary key before the upstream SDP request when enabled, log only expiry metadata, and return 502 on issuance failure.
- [x] Add safe credential-mode fields to `/health`.
- [x] Enable local `.env` with `DASHSCOPE_USE_TEMP_KEY=true` and TTL `600` without changing existing secret values.
- [x] Run the focused tests and Python compilation checks.

### Task 3: Operator instructions and verification

**Files:**
- Modify: `7.14/UniSpeaking/README.md`

- [x] Document the exact `.env` location, startup commands, health check, browser URL, expected log line, ten-minute expiry semantics, and permanent-key comparison switch.
- [x] Run the full unittest discovery command.
- [x] Start the backend locally, request `/health`, and stop it cleanly.
- [x] Inspect the diff and scan tracked changes for accidental API key material.
