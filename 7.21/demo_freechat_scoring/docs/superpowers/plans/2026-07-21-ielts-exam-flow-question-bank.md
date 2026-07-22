# IELTS Exam Flow and Atomic Question Bank Implementation Plan

> **For agentic workers:** Execute this plan task-by-task with test-first RED/GREEN cycles. This repository must remain uncommitted until the user reviews the completed local changes.

**Goal:** Replace the small split IELTS Demo bank with the specified 2026 source data, preserve Part 2/3 as atomic topic bundles, centralize prompts, and implement the confirmed deterministic full-mock flow and timing profiles.

**Architecture:** A Python build-time converter produces one Part 1 bank and one atomic Part 2/3 bank. The browser state machine owns question selection, ordering, timing and transitions; Qwen Realtime only speaks frozen scripts/questions and performs ASR/VAD. Java loads scoring prompts from resources, excludes Introduction turns from provider input, and continues deterministic Band calculation.

**Tech Stack:** Python 3 standard library, browser ES modules, Node `node:test`, Java 21, Spring Boot, JUnit 5, Qwen Realtime/non-realtime, iFlytek ISE.

## Global Constraints

- Use only Qwen Realtime, configurable Qwen non-realtime models, iFlytek ISE, and Java Band rules.
- Preserve the two source JSON files and their schema.
- Never split or independently match a Part 2 card and its nested Part 3 questions.
- Full Mock is strict: no interim scores, corrections or suggestions.
- Preserve existing free-chat behavior.
- Do not commit or push changes.

---

### Task 1: Build the Runtime Question Bank

**Files:**
- Create: `7.21/demo_freechat_scoring/scripts/build_ielts_question_bank.py`
- Create: `7.21/demo_freechat_scoring/tests/test_build_ielts_question_bank.py`
- Generate: `7.14/UniSpeaking_Complete_UI/backend/ielts/question_bank/part1.json`
- Generate: `7.14/UniSpeaking_Complete_UI/backend/ielts/question_bank/part2_part3.json`
- Modify: `7.14/UniSpeaking_Complete_UI/backend/ielts/question_bank/manifest.json`

**Interfaces:**
- `convert_part1(source: dict) -> dict` returns `{groups: [...]}` with source order and review metadata.
- `convert_part2_part3(source: dict) -> dict` returns `{bundles: [...]}`; every bundle contains nested `part2` and `part3` from the same `topic_id`.
- CLI defaults to the approved files and frontend output directory, and accepts `--p1-source`, `--p23-source`, and `--output-dir`.

- [ ] Write Python tests asserting source counts 72/104, atomic `p23_2026_01_04_001` linkage, ordered IDs, review eligibility and structural-error exit behavior.
- [ ] Run `python3 -m unittest tests/test_build_ielts_question_bank.py -v` and verify RED because the converter module does not exist.
- [ ] Implement pure conversion/validation functions and a CLI using only the Python standard library.
- [ ] Re-run the converter tests and verify GREEN.
- [ ] Run the CLI against the two approved source files and verify generated counts and manifest paths.

### Task 2: Load and Assemble Atomic Papers

**Files:**
- Modify: `7.14/UniSpeaking_Complete_UI/tests/ielts-question-bank.test.mjs`
- Modify: `7.14/UniSpeaking_Complete_UI/tests/ielts-paper-assembler.test.mjs`
- Modify: `7.14/UniSpeaking_Complete_UI/src/ielts/question-bank.mjs`
- Modify: `7.14/UniSpeaking_Complete_UI/src/ielts/paper-assembler.mjs`

**Interfaces:**
- `validateQuestionBank({manifest, part1, part2Part3})` returns `part1Groups` and `part2Part3Bundles`.
- `assemblePaper(bank, {mode, selectedPart, random, now, timingProfile})` freezes `part2Part3TopicId` and both nested parts together.
- Part 1 full mock chooses a target count of 4 or 5, one eligible group, a random subset, then sorts by `order`.

- [ ] Replace fixtures with the two-file manifest and atomic bundle schema.
- [ ] Add failing tests for one-topic Part 1, ordered 4/5 subsets, no rounding-off data, exact Part 2/3 topic ID equality and immutable timing profile snapshots.
- [ ] Run the two Node test files and verify RED against the old split loader/assembler.
- [ ] Implement the minimal loader and assembler changes.
- [ ] Re-run the two test files and verify GREEN.

### Task 3: Centralize Examiner Scripts and Expand the State Machine

**Files:**
- Create: `7.14/UniSpeaking_Complete_UI/src/ielts/examiner-prompt-catalog.mjs`
- Create: `7.14/UniSpeaking_Complete_UI/tests/ielts-examiner-prompt-catalog.test.mjs`
- Modify: `7.14/UniSpeaking_Complete_UI/tests/ielts-state-machine.test.mjs`
- Modify: `7.14/UniSpeaking_Complete_UI/src/ielts/exam-state-machine.mjs`

**Interfaces:**
- `createExaminerPromptCatalog({examinerName='Alex'})` returns `version`, exact English scripts and exact-question instruction builders.
- `START` enters `opening`; `EXAMINER_DONE` enters `introduction`; `SUBMIT_ANSWER` advances to Part 1 after Introduction.
- `PART3_SOFT_LIMIT` marks soft expiry without opening another question; `PART3_HARD_LIMIT` completes the exam.
- `part2_rounding_off` is removed.

- [ ] Write failing prompt tests for the exact `Hello` opening, English-only fixed transitions and non-reading Part 2 behavior.
- [ ] Rewrite state-machine expectations for Opening → Introduction → Part 1 → Part 2 prep/answer → Part 3 → Complete.
- [ ] Run targeted tests and verify RED.
- [ ] Add the prompt catalog and minimal deterministic state transitions.
- [ ] Re-run targeted tests and verify GREEN.

### Task 4: Implement Timing Profiles and Runtime Coordination

**Files:**
- Modify: `7.14/UniSpeaking_Complete_UI/tests/ielts-demo-controller.test.mjs`
- Modify: `7.14/UniSpeaking_Complete_UI/tests/ielts-session-runtime.test.mjs`
- Modify: `7.14/UniSpeaking_Complete_UI/src/ielts/demo-controller.mjs`
- Modify: `7.14/UniSpeaking_Complete_UI/src/ielts/ielts-session-runtime.mjs`

**Interfaces:**
- Real profile: Introduction 60, Part 1 60, Part 2 prep 60, Part 2 answer 120, Part 3 question 60, soft 240, hard 300 seconds.
- Accelerated profile: 15, 20, 10, 45, 20, 60, 75 seconds respectively.
- Controller timers start only after runtime reports examiner `response.done`.
- `completeTurn` carries `turnType`, `scoringEligible`, and `USER_DONE|TIME_LIMIT`.

- [ ] Add failing tests for default real timing, accelerated selection, response-done timer start, automatic per-turn timeout, Part 2 explicit/hard completion, and Part 3 soft/hard behavior.
- [ ] Add failing runtime tests for an Introduction turn and examiner-completion callback.
- [ ] Run targeted tests and verify RED.
- [ ] Implement controller/runtime changes while retaining the shared PCM/ASR path.
- [ ] Re-run targeted tests and verify GREEN.

### Task 5: Update Strict-Mock UI

**Files:**
- Modify: `7.14/UniSpeaking_Complete_UI/tests/ielts-view.test.mjs`
- Modify: `7.14/UniSpeaking_Complete_UI/tests/static-ui.test.mjs`
- Modify: `7.14/UniSpeaking_Complete_UI/src/views/ielts.mjs`
- Modify: `7.14/UniSpeaking_Complete_UI/src/app.mjs`

**Interfaces:**
- Preflight exposes `accelerated_demo` only for Full Mock and defaults it off.
- Session renders Opening/Introduction and all approved timer labels.
- Part 2 renders the complete card while the spoken examiner text contains only the fixed preparation/start scripts.

- [ ] Add failing view tests for the acceleration toggle, Introduction screen, Part 2 no-read contract and Part 3 timing display.
- [ ] Run targeted tests and verify RED.
- [ ] Implement the minimal controls/rendering and wire the new controller action.
- [ ] Re-run targeted tests and verify GREEN.

### Task 6: Externalize Java Prompts and Exclude Introduction from Scoring

**Files:**
- Create: `7.21/demo_freechat_scoring/backend_java/src/main/resources/prompts/ielts/examiner-system.txt`
- Create: `7.21/demo_freechat_scoring/backend_java/src/main/resources/prompts/ielts/language-evidence.txt`
- Create: `7.21/demo_freechat_scoring/backend_java/src/main/resources/prompts/ielts/judge.txt`
- Create: `7.21/demo_freechat_scoring/backend_java/src/main/java/com/example/unispeaking/service/ielts/IeltsPromptCatalog.java`
- Modify: `7.21/demo_freechat_scoring/backend_java/src/test/java/com/example/unispeaking/IeltsAttemptControllerTest.java`
- Modify: `7.21/demo_freechat_scoring/backend_java/src/test/java/com/example/unispeaking/service/QwenScoringServicePromptLanguageTest.java`
- Modify: `7.21/demo_freechat_scoring/backend_java/src/test/java/com/example/unispeaking/service/ielts/IeltsScoringOrchestratorTest.java`
- Modify: `7.21/demo_freechat_scoring/backend_java/src/main/java/com/example/unispeaking/controller/IeltsAttemptController.java`
- Modify: `7.21/demo_freechat_scoring/backend_java/src/main/java/com/example/unispeaking/model/ielts/IeltsAttempt.java`
- Modify: `7.21/demo_freechat_scoring/backend_java/src/main/java/com/example/unispeaking/service/ielts/IeltsTurn.java`
- Modify: `7.21/demo_freechat_scoring/backend_java/src/main/java/com/example/unispeaking/service/ielts/IeltsScoringOrchestrator.java`
- Modify: `7.21/demo_freechat_scoring/backend_java/src/main/java/com/example/unispeaking/service/QwenScoringService.java`
- Modify: `7.21/demo_freechat_scoring/backend_java/src/main/resources/application.properties`

**Interfaces:**
- `IeltsPromptCatalog` exposes versioned examiner/language/judge prompt text loaded from configurable classpath resources.
- Attempt snapshots expose `prompt_version` and `timing_profile`.
- `IeltsTurn.scoringEligible()` is false for Introduction.
- Pronunciation and Qwen provider calls operate only on scoring-eligible Part 1–3 turns.

- [ ] Add failing Java tests for prompt resource loading, exact Realtime restrictions, timing/prompt snapshot fields and Introduction exclusion from both text and pronunciation providers.
- [ ] Run targeted Maven tests and verify RED.
- [ ] Implement resource loading and scoring filtering without changing free-chat prompt behavior.
- [ ] Re-run targeted tests and verify GREEN.

### Task 7: Documentation and Full Verification

**Files:**
- Modify: `7.21/demo_freechat_scoring/.env.example`
- Modify: `7.21/demo_freechat_scoring/README.md`
- Modify: `7.21/demo_freechat_scoring/docs/IELTS_SCORING_MVP_IMPLEMENTATION.md`
- Modify: `7.14/UniSpeaking_Complete_UI/README.md`

- [ ] Document prompt locations, replacement procedure, bank build command, source provenance, timing profiles and Part 2/3 atomic guarantee.
- [ ] Run `python3 -m unittest discover -s tests -p 'test_*.py' -v` in the scoring project.
- [ ] Run `npm test` in the frontend and record pass/fail totals.
- [ ] Run `./mvnw test` in the Java backend and record pass/fail totals.
- [ ] Run `git diff --check` on both project directories.
- [ ] Start backend/frontend, verify health, and perform a browser accelerated Full Mock through Opening → Introduction → Part 1 → Part 2 → same-topic Part 3 → report.
- [ ] Confirm no commits or pushes were created and report all changed files and Demo limitations.

