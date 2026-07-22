# IELTS Speaking Microphone Answer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Replace the IELTS Demo transcript-only answer form with a real browser microphone interaction that supports start, pause, resume, live transcript editing, text fallback, and explicit end-of-turn submission in every answering phase.

**Architecture:** Keep the authoritative IELTS exam state machine unchanged. Add a browser speech-recognition adapter and a separate per-answer controller; the application composes their snapshot with the existing IELTS snapshot, and only the explicit end-of-turn action calls `IeltsDemoController.submitAnswer()`.

**Tech Stack:** Browser ES Modules, Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`), `navigator.mediaDevices.getUserMedia`, Node.js `node:test`, existing HTML/CSS hash-routed app.

## Global Constraints

- Implement the approved spec at `docs/superpowers/specs/2026-07-20-ielts-microphone-answer-design.md`.
- Cover Part 1, Part 2 answering/rounding-off, Part 3 and full mock; Part 2 preparation must not render microphone controls.
- The microphone cycle is `start -> pause -> resume`; only the separate “结束本轮回答” action advances the exam.
- A microphone pause does not pause or mutate the authoritative exam state.
- Real-time final transcripts remain editable and resume appends instead of replacing.
- Permission denial or unsupported APIs must fall back to editable text without blocking the exam.
- Do not upload or persist raw audio and do not claim pronunciation assessment.
- Do not modify deployment, Supabase, Realtime provider, database or question-bank contracts.
- Use TDD for every behavior. The repository contains unrelated user changes, so do not create automatic Git commits; use scoped diff checks as task checkpoints.

---

## File Map

- Create `src/ielts/speech-recognition-adapter.mjs`: normalize browser recognition, permission stream and resource cleanup.
- Create `src/ielts/voice-answer-controller.mjs`: own per-answer state, transcript merging, timer and fallback behavior.
- Create `tests/ielts-speech-recognition-adapter.test.mjs`: fake browser API contract tests.
- Create `tests/ielts-voice-answer-controller.test.mjs`: pure interaction and transcript tests.
- Modify `src/views/ielts.mjs`: render the voice answer panel instead of the transcript-only form.
- Modify `tests/ielts-view.test.mjs`: assert microphone states and Part 2 preparation boundary.
- Modify `src/app.mjs`: construct controllers, forward actions, submit exactly once and dispose resources.
- Modify `tests/static-ui.test.mjs`: assert application wiring and stale-event guards.
- Modify `styles.css`: responsive microphone, waveform, states, transcript and fallback visuals.
- Modify `README.md`: document Chrome/Web Speech behavior and fallback.

### Task 1: Browser speech-recognition adapter

**Files:**
- Create: `src/ielts/speech-recognition-adapter.mjs`
- Create: `tests/ielts-speech-recognition-adapter.test.mjs`

**Interfaces:**
- Produces `createSpeechRecognitionAdapter({ windowRef, mediaDevices, onInterim, onFinal, onError }): SpeechRecognitionAdapter`.
- Adapter methods: `isSupported()`, `start()`, `pause()`, `resume()`, `stop()`, `dispose()`.

- [x] **Step 1: Write failing adapter tests**

Test that support requires both a recognition constructor and `getUserMedia`; `start()` requests `{audio:true}`, configures `lang="en-GB"`, `continuous=true`, `interimResults=true`; result events are separated into interim and final callbacks; `pause()` stops recognition without releasing tracks; `stop()` aborts recognition and stops every media track.

```js
test("normalizes interim and final browser recognition results", async () => {
  const fixture = createBrowserFixture();
  const interim = [];
  const final = [];
  const adapter = createSpeechRecognitionAdapter({
    ...fixture.dependencies,
    onInterim: (text) => interim.push(text),
    onFinal: (text) => final.push(text),
  });
  await adapter.start();
  fixture.recognition.emitResult([result("I enjoy", false), result("travelling", true)]);
  assert.deepEqual(interim, ["I enjoy"]);
  assert.deepEqual(final, ["travelling"]);
});
```

- [x] **Step 2: Run RED**

Run: `node --test tests/ielts-speech-recognition-adapter.test.mjs`  
Expected: `ERR_MODULE_NOT_FOUND` for `speech-recognition-adapter.mjs`.

- [x] **Step 3: Implement the minimal adapter**

Use the unprefixed constructor first, then `webkitSpeechRecognition`. Request the microphone only from `start()`. Create a fresh recognition instance on resume, ignore events after `dispose()`, and map fatal errors (`not-allowed`, `service-not-allowed`, `audio-capture`) to `onError({ code, recoverable:false })`; map `no-speech` to a recoverable error.

- [x] **Step 4: Run GREEN and regression**

Run: `node --test tests/ielts-speech-recognition-adapter.test.mjs && npm test`  
Expected: all tests pass.

- [x] **Step 5: Check scoped diff**

Run: `git diff --check -- src/ielts/speech-recognition-adapter.mjs tests/ielts-speech-recognition-adapter.test.mjs`.

### Task 2: Per-answer voice controller

**Files:**
- Create: `src/ielts/voice-answer-controller.mjs`
- Create: `tests/ielts-voice-answer-controller.test.mjs`

**Interfaces:**
- Produces `createVoiceAnswerController({ createAdapter, clock, onChange }): VoiceAnswerController`.
- Snapshot: `{ status, finalTranscript, interimTranscript, elapsedSeconds, permission, message }`.
- Methods: `getSnapshot()`, `start()`, `pause()`, `resume()`, `updateTranscript(text)`, `finish()`, `reset()`, `dispose()`.

- [x] **Step 1: Write failing state and transcript tests**

```js
test("pauses and resumes one answer while appending final transcript", async () => {
  const fixture = createControllerFixture();
  await fixture.controller.start();
  fixture.adapter.emitFinal("I enjoy reading");
  fixture.controller.pause();
  await fixture.controller.resume();
  fixture.adapter.emitFinal("because it helps me relax");
  assert.equal(fixture.controller.getSnapshot().finalTranscript,
    "I enjoy reading because it helps me relax");
});

test("permission denial enters editable text fallback", async () => {
  const fixture = createControllerFixture({ startError: new Error("NotAllowedError") });
  await fixture.controller.start();
  assert.equal(fixture.controller.getSnapshot().status, "fallback");
  fixture.controller.updateTranscript("Typed answer");
  assert.equal(fixture.controller.finish(), "Typed answer");
});
```

Also test: unsupported adapter falls back without calling `start`; interim does not overwrite manual edits; listening timer pauses and resumes; finish stops the adapter and is idempotent; reset/dispose ignore late events.

- [x] **Step 2: Run RED**

Run: `node --test tests/ielts-voice-answer-controller.test.mjs`  
Expected: missing module failure.

- [x] **Step 3: Implement the controller**

Create the adapter inside the controller with callbacks bound to the active answer generation. Normalize whitespace when appending final segments. Increment `elapsedSeconds` only while `status === "listening"`. On fatal adapter error or rejected start, stop the timer, set `status="fallback"`, keep current transcript and publish a user-readable message.

- [x] **Step 4: Run GREEN and regression**

Run: `node --test tests/ielts-voice-answer-controller.test.mjs && npm test`.

- [x] **Step 5: Check scoped diff**

Run: `git diff --check -- src/ielts/voice-answer-controller.mjs tests/ielts-voice-answer-controller.test.mjs`.

### Task 3: Voice answer view contract

**Files:**
- Modify: `src/views/ielts.mjs`
- Modify: `tests/ielts-view.test.mjs`

**Interfaces:**
- Change `renderIelts(snapshot)` to `renderIelts(snapshot, voiceSnapshot = defaultVoiceSnapshot)`.
- Render actions: `ielts-voice-start`, `ielts-voice-pause`, `ielts-voice-resume`, `ielts-voice-finish`, `ielts-voice-transcript`.

- [x] **Step 1: Write failing view tests**

Assert that idle, listening, paused and fallback snapshots render the correct primary action and accessible copy. Assert a separate finish button is always present during answering, no microphone exists during `part2_preparing`, and full mock still has no retry/next/skip/pause-exam action.

```js
test("listening answer shows pause and an independent end-turn action", () => {
  const html = renderIelts(fullMockPart1Snapshot, voiceSnapshot({ status: "listening" }));
  assert.match(html, /data-action="ielts-voice-pause"/);
  assert.match(html, /data-action="ielts-voice-finish"/);
  assert.match(html, /结束本轮回答/);
});
```

- [x] **Step 2: Run RED**

Run: `node --test tests/ielts-view.test.mjs`  
Expected: missing microphone actions.

- [x] **Step 3: Replace the transcript form with semantic voice markup**

Render a round microphone button, `MM:SS` timer, state text with `aria-live="polite"`, decorative waveform, editable transcript textarea and interim text. In fallback state label the textarea as the active input method. Keep practice-only retry/next actions but never render them for full mock.

- [x] **Step 4: Run GREEN and regression**

Run: `node --test tests/ielts-view.test.mjs && npm test`.

- [x] **Step 5: Check scoped diff**

Run: `git diff --check -- src/views/ielts.mjs tests/ielts-view.test.mjs`.

### Task 4: Application wiring and answer lifecycle

**Files:**
- Modify: `src/app.mjs`
- Modify: `tests/static-ui.test.mjs`

**Interfaces:**
- Construct `voiceAnswerController` using `createVoiceAnswerController` and `createSpeechRecognitionAdapter`.
- IELTS rendering passes both snapshots.
- `ielts-voice-finish` calls `voiceAnswerController.finish()`, then exactly one `ieltsController.submitAnswer(transcript)`, then resets the voice controller for the next answer.

- [x] **Step 1: Write failing wiring tests**

Add static contracts for imports, all five voice actions, editable transcript input, route-leave disposal and finish-before-submit order. Add a controller-level test if a pure helper is extracted for exactly-once submission.

- [x] **Step 2: Run RED**

Run: `node --test tests/static-ui.test.mjs`  
Expected: missing imports/actions.

- [x] **Step 3: Wire browser effects and lifecycle**

Forward click actions to start/pause/resume. Forward transcript `input` only while the IELTS route is active. On finish, submit the returned transcript and reset after the exam transition. Reset on retry/next; dispose when leaving IELTS, restarting or abandoning. Do not request permission during controller construction or initial render.

- [x] **Step 4: Run GREEN and regression**

Run: `node --test tests/static-ui.test.mjs && npm test`.

- [x] **Step 5: Check scoped diff**

Run: `git diff --check -- src/app.mjs tests/static-ui.test.mjs`.

### Task 5: Responsive visuals, documentation and acceptance

**Files:**
- Modify: `styles.css`
- Modify: `README.md`
- Modify: `tests/static-ui.test.mjs`
- Create: `acceptance/ielts/microphone-*.png` through browser screenshots.

- [x] **Step 1: Write failing visual contract tests**

Require `.ielts-voice-panel`, `.ielts-mic-button`, `.is-listening`, `.is-paused`, `.ielts-waveform`, an `@media (prefers-reduced-motion: reduce)` override, minimum 72px desktop microphone, minimum 80px mobile microphone and no textarea-only `DEMO ANSWER TRANSCRIPT` copy.

- [x] **Step 2: Run RED**

Run: `node --test tests/static-ui.test.mjs`  
Expected: missing voice selectors.

- [x] **Step 3: Add styles and README boundary**

Use existing color tokens and rounded panel language. Animate five waveform bars only while listening; freeze them while paused. Document that Chrome provides the best Web Speech API support, permission is requested only after a click, text fallback remains available and raw audio is not uploaded or saved.

- [x] **Step 4: Run complete automated verification**

Run: `npm test`  
Run: `node --check src/app.mjs && for file in src/ielts/*.mjs src/views/ielts.mjs; do node --check "$file"; done`  
Run: parse all `backend/ielts/question_bank/*.json` with `JSON.parse`.  
Run from repository root: `git diff --check -- 7.14/UniSpeaking_Complete_UI docs/superpowers/specs/2026-07-20-ielts-microphone-answer-design.md docs/superpowers/plans/2026-07-20-ielts-microphone-answer.md`.

- [x] **Step 5: Run browser acceptance with injected speech fixtures**

Start `npm run dev` and verify at `http://localhost:8080/#/ielts`:

1. Initial render does not request microphone permission.
2. Start enters listening and shows live transcript.
3. Pause freezes elapsed time; resume appends a second final segment.
4. End turn advances exactly once and resets the next answer to idle.
5. Part 2 preparation hides the microphone; Part 2 answering shows the full cue card above it.
6. Permission denial exposes editable text fallback and can finish the exam.
7. At 390px there is no horizontal overflow and microphone controls remain at least 80px.
8. Console errors, page errors and failed HTTP responses are empty.

- [x] **Step 6: Update planning records**

Mark this plan complete only after fresh automated and browser evidence passes. Record the Web Speech compatibility and no-raw-audio boundary in `task_plan.md`, `findings.md` and `progress.md`.
