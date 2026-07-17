# UniSpeaking Free Chat Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把新版 WebRTC 自由对话真实链路模块化接入 `UniSpeaking_React/#/conversation`，完成本地自动化与浏览器验收，不部署任何环境。

**Architecture:** React 页面通过 `useRealtimeSession` 消费纯 reducer 和唯一 `RealtimeClient`。Client 组合 Python API、麦克风控制器、远端音频播放器、PeerConnection 和 DataChannel；所有资源通过同一幂等 teardown 释放。

**Tech Stack:** Vite 5、React 18、JavaScript/JSX/ES modules、Node test runner、WebRTC、Web Audio、Python aiohttp。

## Global Constraints

- 主应用必须是 `UniSpeaking_React`，Demo 只提供真实能力。
- 不使用 iframe、双 React 根、假对话或客户端 API Key。
- 不修改生产 Supabase，不部署 Vercel Preview/Production。
- 使用 npm 和现有 `package-lock.json`，只增加 lint/typecheck 所需开发依赖。
- 页面卸载、结束、异常和断线都必须停止 tracks、关闭 DataChannel/PeerConnection/audio/AudioContext/计时器。
- 所有生产代码行为先有失败测试。

---

### Task 1: Restore a trustworthy frontend toolchain and current routing tests

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `eslint.config.js`
- Create: `tsconfig.json`
- Create: `src/router.mjs`
- Modify: `src/App.jsx`
- Modify: `tests/router.test.mjs`
- Modify: `tests/review-policy.test.mjs`
- Modify: `tests/training-flow.test.mjs`
- Modify: `tests/static-ui.test.mjs`

**Interfaces:**
- Produces `parseRoute(hash)` and `globalSection(routeName)` for `App.jsx` and tests.
- Produces npm scripts `lint`, `typecheck`, `test`, `build`.

- [x] Step 1: Run the existing failing route/test baseline and record missing `.mjs` errors.
- [x] Step 2: Install from the existing lockfile with `npm ci`, then add pinned ESLint/TypeScript development packages without upgrading React/Vite.
- [x] Step 3: Extract the current route table and functions from `App.jsx` into `src/router.mjs`; import them back into `App.jsx`.
- [x] Step 4: Update old tests to current `.js/.jsx` paths while preserving their business assertions; replace static-page assertions with current React shell/route assertions.
- [x] Step 5: Add `.gitignore`, public-only `.env.example`, flat ESLint config, focused `checkJs` tsconfig, and npm scripts.
- [x] Step 6: Run `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build`; expected result is zero failures before realtime implementation tests are added.

### Task 2: Build the realtime product state machine with TDD

**Files:**
- Create: `tests/realtime-state.test.mjs`
- Create: `src/realtime/realtime-state.mjs`
- Modify: `tests/state.test.mjs`

**Interfaces:**
- Produces `createRealtimeState()`, `applyRealtimeEvent(state, event)`, `sessionStatusText(state)` and `canRetry(state)`.
- Message shape: `{ id, role: "user" | "assistant", text, final }`.

- [x] Step 1: Write tests for all product states, user item rekey, incremental AI text, final transcript replacement, interruption, pause/resume, disconnect, normal end and error.
- [x] Step 2: Run `node --test tests/realtime-state.test.mjs`; expected failure is missing module.
- [x] Step 3: Implement immutable reducer helpers and status text mapping with no DOM dependencies.
- [x] Step 4: Run the target test and then full `npm test`; expected all pass.

### Task 3: Build API, microphone and audio resource owners with TDD

**Files:**
- Create: `tests/realtime-api.test.mjs`
- Create: `tests/microphone.test.mjs`
- Create: `tests/audio-playback.test.mjs`
- Create: `src/services/realtime-api.mjs`
- Create: `src/realtime/microphone.mjs`
- Create: `src/realtime/audio-playback.mjs`

**Interfaces:**
- `createRealtimeApi({ baseUrl, fetchImpl })` returns health/createSession/exchangeSdp/rememberEvent/bindProviderSession/updateLearnerLevel/recordQuality/closeSession.
- `createMicrophone({ mediaDevices })` returns request/getStream/getAudioTracks/setMuted/setPaused/stop.
- `createAudioPlayback({ createAudio, createAudioContext, requestFrame, cancelFrame, onAudibleChange })` returns attach/setPaused/stop/isAudible.

- [x] Step 1: Write failing tests for URL normalization, JSON/SDP parsing, safe HTTP errors, one `getUserMedia`, track flags and idempotent stop.
- [x] Step 2: Write failing audio tests for one audio element/context, audible callback, pause/resume, RAF cancellation and context close.
- [x] Step 3: Run the three target tests; expected failures are missing modules.
- [x] Step 4: Implement minimal modules with dependency injection and `// @ts-check` JSDoc types.
- [x] Step 5: Run target tests, typecheck and full tests; expected all pass.

### Task 4: Build the single RealtimeClient with TDD

**Files:**
- Create: `tests/realtime-client.test.mjs`
- Create: `src/realtime/realtime-client.mjs`

**Interfaces:**
- `createRealtimeClient({ api, microphone, audioPlayback, createPeerConnection, onEvent })`.
- Methods: `start(options)`, `retry()`, `sendText(text)`, `setMuted(value)`, `setPaused(value)`, `stop(options)`, `isActive()`.

- [x] Step 1: Write fake PeerConnection/DataChannel tests proving start is deduplicated, media stays gated until `session.created`, session config and greeting are sent once, provider session is bound, text uses the shared DataChannel, and final events are remembered.
- [x] Step 2: Add tests proving remote track uses the single audio playback owner, pause/mute are distinct, disconnect performs one cleanup and exposes retry, and normal/error teardown is idempotent.
- [x] Step 3: Run `node --test tests/realtime-client.test.mjs`; expected failure is missing module.
- [x] Step 4: Implement event dispatch, SDP normalization, tool output, connection state handling, quality snapshot and the single teardown path.
- [x] Step 5: Run target tests, typecheck and full tests; expected all pass.

### Task 5: Connect the React UI without changing its visual system

**Files:**
- Create: `src/hooks/useRealtimeSession.js`
- Modify: `src/views/ConversationView.jsx`
- Modify: `src/App.jsx`
- Modify: `styles.css`
- Modify: `vite.config.js`
- Create: `vercel.json`
- Create: `tests/conversation-integration.test.mjs`

**Interfaces:**
- Hook returns `{ state, start, retry, togglePause, toggleMute, sendText, end }`.
- `ConversationView` renders reducer messages and maps voice orb/mic/end/text actions to the hook.

- [x] Step 1: Write a failing source integration test asserting the page imports the hook, contains no iframe/Demo redirect/fake response, exposes retry/error status, and routes text through `sendText`.
- [x] Step 2: Run the target test and confirm it fails against the current simulated page.
- [x] Step 3: Implement the hook with one client ref, reducer dispatch, saved conversation id, guarded actions and unmount cleanup.
- [x] Step 4: Refactor `ConversationView.jsx` to preserve current class names/layout while rendering real messages and all required product states; voice orb starts/pauses/resumes, chat button toggles text UI, mic button mutes, end releases the session.
- [x] Step 5: Add minimal CSS for partial subtitles, disabled controls, error/retry and new voice state classes; do not redesign the page.
- [x] Step 6: Configure Vite local port 8080 and add future static-host security headers in `vercel.json`, without deployment commands.
- [x] Step 7: Run integration test, lint, typecheck, full tests and build; expected all pass.

### Task 6: Local services, browser verification, security scan and docs

**Files:**
- Modify: `README.md`
- Modify: `../UniSpeaking/.env.example`
- Create: `docs/free-chat-integration-result.md`
- Modify: `../../progress.md`
- Modify: `../../findings.md`
- Modify: `../../task_plan.md`

**Interfaces:**
- Documents exact frontend/backend commands, required env names, Vercel/Supabase relationship, tests and deployment blockers.

- [x] Step 1: Check required environment variable names and missing status without displaying values.
- [x] Step 2: Start Python backend and Vite frontend locally; verify `/health` reports configuration booleans only.
- [x] Step 3: Use the in-app browser to verify `#/conversation`, route refresh, main product pages, console errors, network calls, microphone permission and the real session flow as far as available credentials/device permission allow.
- [x] Step 4: End the session and navigate away; verify no duplicate media/connection requests and no blocking console errors.
- [x] Step 5: Run fresh full `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, Python tests and a client bundle secret-name scan.
- [x] Step 6: Update README, env examples and result document with exact evidence and remaining issues; do not claim unavailable real audio evidence.
