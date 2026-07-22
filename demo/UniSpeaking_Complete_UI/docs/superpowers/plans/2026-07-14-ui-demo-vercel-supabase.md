# UniSpeaking UI-Demo Integration and Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the proven Bailian WebRTC free-talk flow to the complete UniSpeaking Web UI, migrate server state to Supabase, deploy the API as a Supabase Edge Function, deploy the UI to Vercel, and document the complete process. iOS and Android were explicitly removed from this execution scope.

**Architecture:** Vercel serves the static ES Modules UI. The browser owns microphone capture, RTCPeerConnection, DataChannel, live transcript and audio playback. A stateless Supabase Edge Function creates sessions, proxies SDP with server-side Bailian credentials, persists selected text/metrics in Postgres, and applies policy/rate limits.

**Tech Stack:** HTML, CSS, JavaScript ES Modules, Node.js built-in test runner, Supabase Postgres, Supabase Edge Functions (Deno/TypeScript), Vercel static hosting, Bailian Qwen Realtime WebRTC.

## Global Constraints

- Preserve the approved visual design and all non-conversation routes.
- Never expose or commit `DASHSCOPE_API_KEY`, `BAILIAN_WORKSPACE_ID`, service-role keys, or database credentials.
- Do not persist raw user or assistant audio.
- Reuse the confirmed existing Supabase project; do not create a paid project.
- Preserve the pre-existing modification to `../UniSpeaking/data/latency_report.md`.
- Do not add a third hosting platform.
- The final public application must use the complete UI, not an iframe of `webrtc_demo.html`.

---

### Task 1: Restore the complete UI baseline

**Files:**
- Create: `src/views/training.mjs`
- Modify: `src/app.mjs`
- Test: `tests/static-ui.test.mjs`
- Test: `tests/training-view.test.mjs`

**Interfaces:**
- Consumes: `TRAINING_STEPS`, `sceneCategories`, `sentences`, `learningAssets`, shared `icon()` and current state fields.
- Produces: `renderTraining(stage: string, state: object): string`.

- [ ] Add a focused test importing `renderTraining` and checking all four stages render stable headings and approved route links.
- [ ] Run `node --test tests/training-view.test.mjs`; expect failure because `src/views/training.mjs` does not exist.
- [ ] Implement `renderTraining` using existing data and CSS class names referenced by `app.mjs` and acceptance screenshots.
- [ ] Add the missing `learningAssets` import to `src/app.mjs`, which is used by the review recording handler.
- [ ] Run `node --test tests/*.test.mjs`; expect 16 tests passing and zero failures.

### Task 2: Build pure Realtime state and message logic

**Files:**
- Create: `src/realtime/realtime-state.mjs`
- Create: `src/realtime/realtime-messages.mjs`
- Create: `src/realtime/realtime-events.mjs`
- Test: `tests/realtime-state.test.mjs`
- Test: `tests/realtime-messages.test.mjs`
- Test: `tests/realtime-events.test.mjs`

**Interfaces:**
- Produces: `transitionRealtimeState(current, event)`, `upsertRealtimeMessage(messages, update)`, `normalizeRealtimeEvent(raw)`.
- State values: `idle`, `requesting_mic`, `creating_session`, `connecting`, `listening`, `ai_speaking`, `ending`, `ended`, `error`.

- [ ] Write tests for legal state transitions, illegal transition rejection, repeated deltas, final replacement, stale response rejection, user transcription events, assistant transcript events and provider errors.
- [ ] Run the three test files; expect module-not-found failures.
- [ ] Implement the three pure modules without DOM, fetch, WebRTC or timers.
- [ ] Run the three test files; expect all cases passing.

### Task 3: Build the cloud API client and browser Realtime runtime

**Files:**
- Create: `src/services/config.mjs`
- Create: `src/services/realtime-api.mjs`
- Create: `src/realtime/realtime-client.mjs`
- Create: `src/realtime/realtime-metrics.mjs`
- Test: `tests/realtime-api.test.mjs`
- Test: `tests/realtime-client.test.mjs`

**Interfaces:**
- `createRealtimeApi({ baseUrl, publishableKey, fetchImpl, timeoutMs })` returns `health`, `createSession`, `exchangeSdp`, `saveEvent`, `updateLearnerLevel`, `saveMetrics`, `closeSession`.
- `createRealtimeClient({ api, mediaDevices, RTCPeerConnectionImpl, AudioContextImpl, onState, onMessages, onError })` returns `start`, `setMuted`, `sendText`, `end`, `getState`.

- [ ] Write API client tests for headers, timeout, normalized errors and path construction.
- [ ] Write Realtime runtime tests with fake MediaStream, tracks, PeerConnection and DataChannel covering start, mute, message event, send text and idempotent cleanup.
- [ ] Run the tests; expect module-not-found failures.
- [ ] Implement config resolution from `window.__UNISPEAKING_CONFIG__` with safe empty defaults.
- [ ] Implement the API client using `AbortController` and publishable-key authorization.
- [ ] Implement the Realtime client by extracting the validated flow from `../UniSpeaking/webrtc_demo.html`; omit video and remote recording from the product UI.
- [ ] Run all Node tests; expect zero failures.

### Task 4: Connect the runtime to the approved UI

**Files:**
- Modify: `src/state.mjs`
- Modify: `src/views/conversation.mjs`
- Modify: `src/app.mjs`
- Modify: `index.html`
- Modify: `styles.css`
- Test: `tests/conversation-realtime.test.mjs`
- Test: `tests/state.test.mjs`

**Interfaces:**
- UI state adds `realtimeState`, `realtimeMessages`, `realtimeError`, `learnerLevel`, `sessionId`, `conversationId`, `muted`.
- Existing static conversations remain available for historical mock routes but are not mutated by live sessions.

- [ ] Add tests verifying conversation markup for idle, connecting, listening, AI speaking and error states; verify live messages and buttons map to the correct actions.
- [ ] Run focused tests; expect failures against the old simulated UI.
- [ ] Initialize one Realtime client in `app.mjs`, subscribe callbacks to store updates and handle start/mute/end/send-text/topic actions.
- [ ] Update `conversation.mjs` to render live messages, status and retry/error copy without changing the approved layout.
- [ ] Add only the CSS required for state/error accessibility and reduced motion.
- [ ] Add runtime config loading before `app.mjs` in `index.html`.
- [ ] Run `node --test tests/*.test.mjs`; expect all tests passing.

### Task 5: Create the Supabase database and Edge Function source

**Files:**
- Create: `supabase/migrations/202607140001_realtime_demo.sql`
- Create: `supabase/functions/realtime-api/index.ts`
- Create: `supabase/functions/realtime-api/deno.json`
- Create: `supabase/functions/realtime-api/_shared.ts`
- Create: `supabase/functions/realtime-api/README.md`
- Test: `tests/supabase-source.test.mjs`

**Interfaces:**
- Routes: `GET /health`, `POST /session`, `POST /sdp`, `POST /events`, `POST /learner-level`, `POST /metrics`, `DELETE /session`.
- All JSON errors use `{ error: { code, message, retryable } }`.

- [ ] Add a static source test that verifies every route, required Secret name, CORS branch, rate-limit branch, RLS statements and no literal credential pattern.
- [ ] Run the test; expect failure because migration/function files do not exist.
- [ ] Write idempotent SQL for five tables, constraints, indexes, cleanup function and RLS policies.
- [ ] Port prompt composition, level labels and one-step level policy from `../UniSpeaking/backend/business_logic.py` into Edge Function helpers.
- [ ] Implement SDP proxy using external `fetch`, content-type `application/sdp`, request size limit and response sanitization.
- [ ] Implement database writes through the function service context, session expiry and hashed client rate limits.
- [ ] Run the static source test and all UI tests; expect zero failures.

### Task 6: Prepare static Vercel deployment and local documentation

**Files:**
- Create: `package.json`
- Create: `vercel.json`
- Create: `runtime-config.example.js`
- Create: `.gitignore`
- Create: `README.md`
- Test: `tests/deployment-config.test.mjs`

**Interfaces:**
- `npm test` runs `node --test tests/*.test.mjs`.
- `vercel.json` serves static assets, applies security headers and preserves hash routing.

- [ ] Add tests for Vercel configuration, security headers, ignored local runtime config and package scripts.
- [ ] Run focused test; expect missing-file failures.
- [ ] Implement the deployment files without embedding secrets.
- [ ] Run `npm test`; expect all tests passing.

### Task 7: Apply Supabase migration and deploy the Edge Function

**External state:** confirmed existing Supabase project.

- [ ] Use the Supabase plugin to apply `202607140001_realtime_demo.sql`.
- [ ] Inspect tables and advisors; expect five public tables, RLS enabled and no critical security finding.
- [ ] Configure `DASHSCOPE_API_KEY`, `BAILIAN_WORKSPACE_ID`, `BAILIAN_MODEL` and `ALLOWED_ORIGINS` as Supabase Secrets without printing their values.
- [ ] Use the Supabase plugin to deploy `realtime-api` with `verify_jwt: true`.
- [ ] Read function metadata/logs and call `/health`; expect configured status without secret values.
- [ ] Obtain the Supabase project URL and active Publishable Key, then set public runtime config.

### Task 8: Deploy to Vercel and verify production

**External state:** create a Vercel project/deployment in the confirmed Team.

- [ ] Run the full local test suite immediately before deployment.
- [ ] Use the Vercel plugin to deploy `UniSpeaking_Complete_UI`.
- [ ] Inspect build logs and deployment status; expect successful production URL.
- [ ] Update Supabase allowed origin to the production URL and redeploy the function if required.
- [ ] Fetch production `/`, JavaScript modules and static assets; expect HTTP 200.
- [ ] Open the production UI and verify navigation, microphone permission UI, session creation, WebRTC connection, user transcription, AI text/audio, mute and end cleanup.
- [ ] Inspect Vercel and Supabase logs for uncaught errors and credential leakage.

### Task 9: Write the user-facing integration and deployment guide

**Files:**
- Create: `UniSpeaking_UI与Demo链接及部署操作说明.md`
- Modify: `/Users/mac/Documents/七牛云/task_plan.md`
- Modify: `/Users/mac/Documents/七牛云/findings.md`
- Modify: `/Users/mac/Documents/七牛云/progress.md`

- [ ] Document source-to-target mapping, browser-to-cloud data flow, database schema, Edge Function routes and credential boundary.
- [ ] Document exact local test/run flow and actual plugin deployment order.
- [ ] Record production URLs/project names, verification results, logs and any remaining manual action without recording secret values.
- [ ] Document update, redeploy, troubleshooting and rollback procedures.
- [x] Run placeholder and secret-pattern scans; confirm no unfinished placeholder, real API key, service role key or Workspace value is present.
- [ ] Update global planning files with final evidence and remaining risk.

## Execution Mode

Inline execution is pre-authorized by the user. Do not dispatch subagents. Preserve unrelated working-tree changes and stop only for an external authorization or Secret-management action that cannot be completed through available tools.

## Execution Outcome (2026-07-14)

- Complete UI baseline restored, including `src/views/training.mjs` and the missing data import.
- Realtime state, API and WebRTC client modules implemented and connected to the approved conversation UI.
- Supabase migration `realtime_web` applied; five RLS-protected tables created.
- Edge Function deployed as `realtime-gateway`, version 1, status `ACTIVE`.
- Vercel project `unispeaking-web` deployed to production and verified at <https://unispeaking-web.vercel.app>.
- Automated tests, local browser rendering, production HTTP/modules, Supabase health, and session create/close verified.
- Full process documented in `UniSpeaking_UI与Demo链接及部署操作说明.md`.
- Remaining external action: sign in to Supabase Dashboard and set `DASHSCOPE_API_KEY` plus `BAILIAN_WORKSPACE_ID`; the connector does not expose Secret writes and the browser session was not authenticated. End-to-end model SDP/audio verification depends on this action.
