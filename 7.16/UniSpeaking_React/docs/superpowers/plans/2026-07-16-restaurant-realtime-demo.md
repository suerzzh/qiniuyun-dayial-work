# Restaurant Realtime Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make only the “餐厅特殊需求” daily recommendation open a real child restaurant-ordering voice simulation with its reviewed server-side prompt.

**Architecture:** Keep the current training shell and render a dedicated restaurant session UI that consumes the existing `useRealtimeSession` lifecycle. Pass a fixed `scenario_id` through the existing session API so the Supabase Edge Function selects a reviewed prompt from a strict allowlist without exposing it to the browser.

**Tech Stack:** Vite, React 18, JavaScript with TypeScript checking, WebRTC, Supabase Edge Functions (Deno TypeScript), Node test runner.

## Global Constraints

- Web only; do not change native or non-Web clients.
- Change only the restaurant recommendation behavior; preserve every other scene.
- Do not add dependencies or modify database schema.
- Keep all API keys and full system prompts server-side.
- Follow RED → GREEN TDD and verify resource teardown through the existing hook/client tests.

---

### Task 1: Lock the restaurant route and realtime contract

**Files:**
- Modify: `tests/static-ui.test.mjs`
- Modify: `tests/realtime-api.test.mjs`
- Modify: `tests/realtime-client.test.mjs`
- Modify: `tests/realtime-gateway-contract.test.mjs`

**Interfaces:**
- Produces: fixed scenario ID `child-restaurant-ordering` and route `#/training/restaurant/simulation?direct=true`.

- [ ] Add assertions that only the restaurant card receives the direct simulation route.
- [ ] Add an API assertion that `{ scenario_id: "child-restaurant-ordering" }` is serialized in `/api/sessions`.
- [ ] Add a client assertion that `start({ scenarioId })` forwards the scenario ID.
- [ ] Add gateway assertions for the exact reviewed restaurant prompt and strict scenario selection.
- [ ] Run `node --test tests/static-ui.test.mjs tests/realtime-api.test.mjs tests/realtime-client.test.mjs tests/realtime-gateway-contract.test.mjs`; expect failures because the scenario contract is absent.

### Task 2: Thread scenario metadata through the existing realtime client

**Files:**
- Modify: `src/services/realtime-api.mjs`
- Modify: `src/realtime/realtime-client.mjs`
- Modify: `src/hooks/useRealtimeSession.js`

**Interfaces:**
- Consumes: `useRealtimeSession({ scenarioId?: string })`.
- Produces: `/api/sessions` body field `scenario_id` and scenario-isolated localStorage conversation IDs.

- [ ] Extend JSDoc types with `scenarioId`/`scenario_id`.
- [ ] Forward `scenario_id` from client start to API without changing the default empty value behavior.
- [ ] Make the hook pass its optional fixed scenario ID and use a separate storage key for that scene.
- [ ] Run the targeted realtime tests; expect PASS.

### Task 3: Add the real restaurant training UI

**Files:**
- Create: `src/views/RestaurantSimulationSession.jsx`
- Modify: `src/views/ScenesView.jsx`
- Modify: `src/views/TrainingView.jsx`
- Modify: `styles.css`

**Interfaces:**
- Consumes: `useRealtimeSession({ scenarioId: "child-restaurant-ordering" })`.
- Produces: an auto-starting simulation transcript with pause, mute, retry, hint, and end controls.

- [ ] Route the restaurant card directly to its simulation while leaving other cards unchanged.
- [ ] Render restaurant-specific title, description and dedicated component only for the restaurant simulation route.
- [ ] Auto-start once on mount; map messages and realtime states into the existing simulation layout.
- [ ] Add only the CSS required for scrollable live turns and responsive controls.
- [ ] Run the static UI tests; expect PASS.

### Task 4: Add the server-only restaurant prompt selector

**Files:**
- Create: `../supabase/functions/realtime-gateway/clara_restaurant_child_en.txt`
- Modify: `../supabase/functions/realtime-gateway/index.ts`

**Interfaces:**
- Consumes: optional request body `scenario_id`.
- Produces: restaurant-only `session_config.instructions` when the ID exactly equals `child-restaurant-ordering`.

- [ ] Copy the reviewed English prompt exactly into the server prompt asset.
- [ ] Bundle the reviewed prompt through the function `static_files` configuration and read it only in the Edge runtime.
- [ ] Select restaurant instructions only for the allowlisted ID; keep the default prompt path unchanged.
- [ ] Run the gateway contract test; expect PASS and exact prompt equality.

### Task 5: Verify the Web demo end-to-end

**Files:**
- Modify: `.planning/restaurant-scenario-demo/task_plan.md`
- Modify: `.planning/restaurant-scenario-demo/progress.md`
- Modify: `.planning/restaurant-scenario-demo/findings.md`

- [ ] Run `npm run lint && npm run typecheck && npm test && npm run build`; expect exit code 0 and all tests passing.
- [ ] Search `dist` for server prompt markers and secret names; expect no full restaurant prompt or secret key values.
- [ ] Start the local app and use a browser to click the second card, confirm the restaurant page, automatic microphone request, visible realtime status, and direct-route refresh.
- [ ] End or leave the session and confirm the page no longer owns an active connection.
- [ ] Record all results and remaining external-key limitations in planning files.
