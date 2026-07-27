# UniSpeaking Production Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the old UniSpeaking production frontend and realtime gateway with the reviewed 7.16 version while reusing the existing domain and project-scoped keys.

**Architecture:** Deploy a compatibility-focused Supabase Edge Function v4 against the existing database and secrets, then deploy the Vite frontend from `7.16/UniSpeaking_React` to the existing Vercel project. The frontend sends only the public Supabase publishable key; all Bailian and database secrets stay server-side.

**Tech Stack:** Vite 5, React 18, Node test runner, Supabase Edge Runtime (Deno/TypeScript), PostgREST, Vercel.

## Global Constraints

- Do not print or commit secret values.
- Do not create a replacement Supabase project.
- Preserve `app.unispeaking.cn` and reuse the existing Vercel/Supabase project identities.
- Use the exact reviewed Clara prompt from `UniSpeaking/backend/clara_current_en.txt`.
- Keep legacy gateway paths working during cutover.
- Do not modify unrelated parent-repository changes.

---

### Task 1: Frontend publishable-key transport

**Files:**
- Modify: `7.16/UniSpeaking_React/src/services/realtime-api.mjs`
- Modify: `7.16/UniSpeaking_React/src/hooks/useRealtimeSession.js`
- Modify: `7.16/UniSpeaking_React/.env.example`
- Modify: `7.16/UniSpeaking_React/tests/realtime-api.test.mjs`

**Interfaces:**
- Consumes: `createRealtimeApi({ baseUrl, fetchImpl })`
- Produces: `createRealtimeApi({ baseUrl, publicKey, fetchImpl })` with an optional `apikey` request header

- [ ] Add a failing test asserting that every JSON and SDP request includes the configured `apikey` without changing request bodies.
- [ ] Run `npm test -- tests/realtime-api.test.mjs` and confirm the new assertion fails.
- [ ] Add optional public-key validation and a shared request-header builder.
- [ ] Read `VITE_SUPABASE_PUBLISHABLE_KEY` in the realtime hook and document it in `.env.example`.
- [ ] Run frontend test, lint, typecheck, and build.

### Task 2: Supabase realtime gateway v4

**Files:**
- Create: `7.16/supabase/config.toml`
- Create: `7.16/supabase/functions/realtime-gateway/deno.json`
- Create: `7.16/supabase/functions/realtime-gateway/index.ts`
- Create: `7.16/UniSpeaking_React/tests/realtime-gateway-contract.test.mjs`

**Interfaces:**
- Consumes: existing `learner_profiles`, `realtime_sessions`, `session_messages`, `realtime_metrics`, and `request_rate_limits` tables
- Produces: the Python-compatible API paths listed in the design plus legacy v3 aliases

- [ ] Add source-contract tests for all required routes, public-key validation, CORS, secret isolation, and exact Clara prompt inclusion.
- [ ] Run the contract test and confirm it fails because the function source is absent.
- [ ] Implement the gateway using the existing v3 database and rate-limit patterns.
- [ ] Store provider-session and quality payloads in `realtime_metrics` without schema changes.
- [ ] Run all frontend and backend tests and verify the production build.

### Task 3: Deploy and validate Supabase gateway

**Files:**
- Deploy: `7.16/supabase/functions/realtime-gateway/index.ts`
- Deploy: `7.16/supabase/functions/realtime-gateway/deno.json`

**Interfaces:**
- Consumes: existing Supabase project `ropgifqbblzktgxllupi`
- Produces: active `realtime-gateway` v4

- [ ] Deploy the function with `verify_jwt=false`; the function performs its own publishable-key check.
- [ ] Confirm the active version increased and status is `ACTIVE`.
- [ ] Verify `GET /health` rejects a missing key and accepts the active publishable key.
- [ ] Create a live session and confirm the response contains a session ID and the reviewed prompt markers.
- [ ] Inspect Edge Function logs for new errors.

### Task 4: Deploy the Vercel frontend

**Files:**
- Deploy root: `7.16/UniSpeaking_React`

**Interfaces:**
- Consumes: the live Supabase gateway base URL and publishable key
- Produces: a production Vercel deployment for project `unispeaking-web`

- [ ] Configure `VITE_REALTIME_API_BASE` and `VITE_SUPABASE_PUBLISHABLE_KEY` for Production without printing values.
- [ ] Link the frontend directory to the existing Vercel project.
- [ ] Deploy the committed source as Production.
- [ ] Confirm the deployment is `READY` and inspect build/runtime errors.
- [ ] Verify the Vercel URL and `app.unispeaking.cn` load the new UI.

### Task 5: Final production verification and cleanup

**Files:**
- Modify: `7.16/UniSpeaking_React/docs/free-chat-integration-result.md`

**Interfaces:**
- Consumes: production frontend and gateway
- Produces: evidence-backed deployment record

- [ ] Verify direct navigation to the conversation hash route.
- [ ] Check browser console and network requests.
- [ ] Exercise microphone permission and a real session as far as browser automation permits.
- [ ] Confirm no server secret appears in the built frontend or Git diff.
- [ ] Record deployment URLs, versions, tests, limitations, and cleanup results.
- [ ] Commit and push deployment-source changes to `codex/integrate-free-chat-v2`.
