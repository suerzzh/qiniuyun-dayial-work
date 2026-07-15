# Local Session Identity Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture Qwen Realtime `session.created.session.id`, bind it to one test user, and write a comparison text file when the local Demo session closes.

**Architecture:** Keep the existing browser-to-Qwen WebRTC data path unchanged. Add one small backend identity module, one binding endpoint, and one browser callback; persist only the final local validation record.

**Tech Stack:** Python 3.11, aiohttp, browser JavaScript, unittest

## Global Constraints

- Use fixed `DEMO_USER_ID`, default `demo-user-001`; this is not production authentication.
- Do not query cloud logs or implement usage aggregation in this validation.
- Preserve existing temporary-key behavior and existing user changes.

---

### Task 1: Session identity domain and text output

**Files:**
- Create: `7.14/UniSpeaking/backend/session_identity.py`
- Create: `7.14/UniSpeaking/tests/test_session_identity.py`

**Interfaces:**
- Produces: `validate_provider_session_id(value: object) -> str`
- Produces: `bind_provider_session_id(session: SessionState, value: object) -> str`
- Produces: `write_session_identity_record(path: Path, session: SessionState, ended_at: str) -> dict[str, str]`

- [x] Write tests for valid/invalid IDs, idempotent binding, conflicting binding, and generated text.
- [x] Run `python -m unittest tests.test_session_identity -v`; expect failure because the module is missing.
- [x] Implement the smallest validation, binding, and UTF-8 text writer.
- [x] Re-run the test; expect all tests to pass.

### Task 2: Backend lifecycle integration

**Files:**
- Modify: `7.14/UniSpeaking/backend/business_logic.py`
- Modify: `7.14/UniSpeaking/backend/app.py`
- Modify: `7.14/UniSpeaking/tests/test_session_identity.py`

**Interfaces:**
- Consumes: Task 1 identity functions.
- Produces: `POST /api/sessions/{session_id}/provider-session` and a DELETE response containing the final record.

- [x] Add an aiohttp endpoint test covering create, bind, close, and output file.
- [x] Run the focused test and observe failure before route implementation.
- [x] Add `user_id`/`provider_session_id` to `SessionState`, configure the output path, bind endpoint, and close-time writer.
- [x] Re-run the focused test; expect pass.

### Task 3: Browser capture and operator instructions

**Files:**
- Modify: `7.14/UniSpeaking/webrtc_demo.html`
- Modify: `7.14/UniSpeaking/.env.example`
- Modify: `7.14/UniSpeaking/README.md`

**Interfaces:**
- Consumes: `session.created.session.id` and Task 2 binding endpoint.
- Produces: a close flow that waits for binding and tells the operator where to compare the result.

- [x] Capture and validate `event.session.id` when `session.created` arrives.
- [x] Wait for the pending bind before DELETE and log the generated record path.
- [x] Document `DEMO_USER_ID` and `data/last_session_identity.txt` comparison steps.
- [x] Run full unittest discovery, compileall, HTML static assertions, and `git diff --check`.
