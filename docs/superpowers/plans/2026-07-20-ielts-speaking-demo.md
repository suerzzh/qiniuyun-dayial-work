# IELTS Speaking Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 在现有 `7.14/UniSpeaking_Complete_UI` 中增加一个可本地交互的 IELTS Speaking Demo，演示后端 JSON 题库契约、随机组卷、Part 1/2/3 状态流、Part 2 全题卡与考后练习反馈。

**Architecture:** Demo 保持现有原生 ES Module 架构，新增纯函数题库、组卷和状态机模块，再由浏览器内 `IeltsDemoController` 扮演后端编排层。视图只读取控制器快照并发送事件；真实 Realtime 音频由浏览器 `speechSynthesis` 做 Demo 替身，不修改现有 Supabase/Realtime 生产链路。

**Tech Stack:** Browser ES Modules, HTML/CSS, Node.js `node:test`, JSON question bank, existing hash router.

## Global Constraints

- 只修改 `/Users/mac/Documents/七牛云/7.14/UniSpeaking_Complete_UI` 内的 Demo 相关文件及本计划/全局 planning 文件。
- 不修改 Vercel、Supabase、RLS、Edge Function 或生产数据库。
- 不复用普通场景“词语 → 句子 → 模拟”领域流程。
- 所有核心考题来自 JSON；模型替身不生成或改写核心题。
- 完整模考 Part 1/3 不显示独立题卡；Part 2 准备和回答时始终显示完整 cue card。
- 字幕默认关闭但会话中可切换；录音默认关闭且只能开考前选择。
- Demo 不输出精确 0–9 分或“官方标准打分报告”。
- 使用 TDD：每个新行为先看到预期红灯，再写最小实现。
- 根仓库存在与本功能无关的用户改动；本轮不自动创建 Git 提交，每个任务以定向测试与 diff 检查作为检查点。

---

## File Map

### Question bank and domain

- Create `7.14/UniSpeaking_Complete_UI/backend/ielts/question_bank/manifest.json`: 题库版本和 Demo 默认配置。
- Create `7.14/UniSpeaking_Complete_UI/backend/ielts/question_bank/part1.json`: Part 1 熟悉话题组。
- Create `7.14/UniSpeaking_Complete_UI/backend/ielts/question_bank/part2.json`: 完整 cue cards 和 JSON 收尾题。
- Create `7.14/UniSpeaking_Complete_UI/backend/ielts/question_bank/part3.json`: 带 `topic_cluster` 的 Part 3 题组。
- Create `7.14/UniSpeaking_Complete_UI/src/ielts/question-bank.mjs`: 加载、校验并归一化 JSON。
- Create `7.14/UniSpeaking_Complete_UI/src/ielts/paper-assembler.mjs`: 随机组卷、主题关联、历史回避和快照。
- Create `7.14/UniSpeaking_Complete_UI/src/ielts/exam-state-machine.mjs`: 纯函数考试状态转移。
- Create `7.14/UniSpeaking_Complete_UI/src/ielts/feedback.mjs`: 非数字化四维练习反馈。
- Create `7.14/UniSpeaking_Complete_UI/src/ielts/demo-controller.mjs`: 组卷、定时、会话记录、字幕和 Demo TTS 协调。

### UI integration

- Create `7.14/UniSpeaking_Complete_UI/src/views/ielts.mjs`: IELTS 首页、预检、考试桌面和报告视图。
- Modify `7.14/UniSpeaking_Complete_UI/src/router.mjs`: 增加 `#/ielts` 路由。
- Modify `7.14/UniSpeaking_Complete_UI/src/views/scenes.mjs`: 将 IELTS 专业入口连到 Demo。
- Modify `7.14/UniSpeaking_Complete_UI/src/app.mjs`: 创建控制器、渲染 IELTS 页面并转发 UI 事件。
- Modify `7.14/UniSpeaking_Complete_UI/styles.css`: 增加 IELTS 桌面端/移动端样式。
- Modify `7.14/UniSpeaking_Complete_UI/README.md`: 补充 Demo 运行、操作和架构假设。

### Tests

- Create `7.14/UniSpeaking_Complete_UI/tests/ielts-question-bank.test.mjs`.
- Create `7.14/UniSpeaking_Complete_UI/tests/ielts-paper-assembler.test.mjs`.
- Create `7.14/UniSpeaking_Complete_UI/tests/ielts-state-machine.test.mjs`.
- Create `7.14/UniSpeaking_Complete_UI/tests/ielts-demo-controller.test.mjs`.
- Create `7.14/UniSpeaking_Complete_UI/tests/ielts-view.test.mjs`.
- Modify `7.14/UniSpeaking_Complete_UI/tests/router.test.mjs`.
- Modify `7.14/UniSpeaking_Complete_UI/tests/static-ui.test.mjs`.

---

### Task 1: JSON question bank contract

**Files:**
- Create: `backend/ielts/question_bank/manifest.json`
- Create: `backend/ielts/question_bank/part1.json`
- Create: `backend/ielts/question_bank/part2.json`
- Create: `backend/ielts/question_bank/part3.json`
- Create: `src/ielts/question-bank.mjs`
- Test: `tests/ielts-question-bank.test.mjs`

**Interfaces:**
- Produces: `loadQuestionBank(loadJson): Promise<QuestionBank>`
- Produces: `validateQuestionBank({manifest, part1, part2, part3}): QuestionBank`
- `QuestionBank` exposes `{ bankVersion, config, part1Groups, part2Cards, part3Groups }`.

- [x] **Step 1: Write failing contract tests**

```js
test("loads all manifest files and validates Part 2/3 coverage", async () => {
  const bank = await loadQuestionBank(fakeJsonLoader(validFixtures));
  assert.equal(bank.bankVersion, "2026.07.20-demo.1");
  assert.ok(bank.part2Cards.every((card) =>
    bank.part3Groups.some((group) => group.topicCluster === card.topicCluster)));
});

test("rejects a Part 2 topic cluster without a Part 3 group", () => {
  assert.throws(() => validateQuestionBank(orphanClusterFixtures), /topic_cluster/);
});
```

- [x] **Step 2: Run RED**

Run: `node --test tests/ielts-question-bank.test.mjs`  
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/ielts/question-bank.mjs`.

- [x] **Step 3: Add JSON fixtures and minimal validator/loader**

```js
export async function loadQuestionBank(loadJson) {
  const manifest = await loadJson("manifest.json");
  const [part1, part2, part3] = await Promise.all([
    loadJson(manifest.files.part1),
    loadJson(manifest.files.part2),
    loadJson(manifest.files.part3),
  ]);
  return validateQuestionBank({ manifest, part1, part2, part3 });
}
```

Implement the validator with five explicit guards: collect every group/card/question ID into one `Set` and throw on duplicate insertion; require at least two active Part 1 groups; require every active cue card to contain non-empty `topic_sentence`, at least three non-empty `you_should_say` entries and non-empty `explain`; require at least one active Part 3 group for every active cue-card `topic_cluster`; require every active Part 3 group to contain at least two questions.

- [x] **Step 4: Run GREEN and full regression**

Run: `node --test tests/ielts-question-bank.test.mjs && npm test`  
Expected: question-bank tests PASS; full suite has 0 failures.

- [x] **Step 5: Inspect scoped diff**

Run: `git diff --check -- backend/ielts/question_bank src/ielts/question-bank.mjs tests/ielts-question-bank.test.mjs`  
Expected: exit 0.

### Task 2: Random paper assembler and immutable snapshot

**Files:**
- Create: `src/ielts/paper-assembler.mjs`
- Test: `tests/ielts-paper-assembler.test.mjs`

**Interfaces:**
- Consumes: normalized `QuestionBank` from Task 1.
- Produces: `assemblePaper(bank, { mode, selectedPart, recentQuestionIds, random, now }): PaperSnapshot`.
- `PaperSnapshot` exposes `{ paperId, bankVersion, mode, parts, assemblyPolicy }`.

- [x] **Step 1: Write failing assembler tests**

```js
test("links Part 3 to the selected Part 2 topic cluster", () => {
  const paper = assemblePaper(bank, deterministicOptions);
  assert.equal(paper.parts.part3.topicCluster, paper.parts.part2.topicCluster);
});

test("avoids recent questions while candidates remain", () => {
  const paper = assemblePaper(bank, { ...deterministicOptions, recentQuestionIds: ["p2_people_001"] });
  assert.notEqual(paper.parts.part2.cardId, "p2_people_001");
});

test("stores rendered text instead of only random seed", () => {
  const paper = assemblePaper(bank, deterministicOptions);
  assert.ok(paper.parts.part1.questions.every((item) => item.renderedText));
});
```

- [x] **Step 2: Run RED**

Run: `node --test tests/ielts-paper-assembler.test.mjs`  
Expected: FAIL with missing module/export.

- [x] **Step 3: Implement minimal deterministic assembler**

```js
function pick(items, random) {
  return items[Math.min(items.length - 1, Math.floor(random() * items.length))];
}

export function assemblePaper(bank, options = {}) {
  const random = options.random || Math.random;
  const recent = new Set(options.recentQuestionIds || []);
  const preferFresh = (items, idOf) => {
    const fresh = items.filter((item) => !recent.has(idOf(item)));
    return fresh.length ? fresh : items;
  };
  const part2 = pick(preferFresh(bank.part2Cards, (item) => item.cardId), random);
  const matchingPart3 = bank.part3Groups.filter((group) => group.topicCluster === part2.topicCluster);
  const part3 = pick(preferFresh(matchingPart3, (item) => item.groupId), random);
  const part1Candidates = preferFresh(bank.part1Groups, (item) => item.groupId);
  const firstPart1 = pick(part1Candidates, random);
  const secondPart1 = pick(part1Candidates.filter((item) => item.groupId !== firstPart1.groupId), random);
  return freezePaperSnapshot(createSnapshot({ bank, options, part1Groups: [firstPart1, secondPart1], part2, part3 }));
}
```

The Demo full paper contains two Part 1 questions, one cue card, one JSON rounding-off question and two Part 3 questions so the UI can be completed quickly; `assemblyPolicy` must label this as `accelerated_demo` while preserving production duration metadata.

- [x] **Step 4: Run GREEN and regression**

Run: `node --test tests/ielts-paper-assembler.test.mjs && npm test`  
Expected: 0 failures.

- [x] **Step 5: Inspect scoped diff**

Run: `git diff --check -- src/ielts/paper-assembler.mjs tests/ielts-paper-assembler.test.mjs`.

### Task 3: Authoritative exam state machine

**Files:**
- Create: `src/ielts/exam-state-machine.mjs`
- Test: `tests/ielts-state-machine.test.mjs`

**Interfaces:**
- Produces: `createExamState(paper, policy): ExamState`.
- Produces: `transitionExam(state, event): ExamState`.
- Produces: `allowedActions(state): string[]`.
- Stable states: `ready`, `part1_answering`, `part2_preparing`, `part2_answering`, `part2_rounding_off`, `part3_answering`, `completed`, `abandoned`.

- [x] **Step 1: Write failing state-transition tests**

```js
test("full mock flows from Part 1 through the timed Part 2 cue card to Part 3", () => {
  let state = createExamState(paper, { mode: "full_mock", prepSeconds: 60 });
  state = transitionExam(state, { type: "START" });
  state = finishAllPart1Answers(state);
  assert.equal(state.status, "part2_preparing");
  state = transitionExam(state, { type: "PREP_EXPIRED" });
  assert.equal(state.status, "part2_answering");
});

test("full mock rejects pause, retry and skip", () => {
  const state = transitionExam(createStartedState(), { type: "PAUSE" });
  assert.match(state.lastError, /not allowed/);
});

test("practice allows retry without advancing the item index", () => {
  const state = transitionExam(createPracticeState(), { type: "RETRY" });
  assert.equal(state.currentItemIndex, 0);
  assert.equal(state.attemptNo, 2);
});
```

- [x] **Step 2: Run RED**

Run: `node --test tests/ielts-state-machine.test.mjs`  
Expected: missing module/export failure.

- [x] **Step 3: Implement pure transition table**

```js
export function transitionExam(state, event) {
  if (TERMINAL_STATES.has(state.status)) return state;
  if (!allowedActions(state).includes(EVENT_TO_ACTION[event.type])) {
    return { ...state, lastError: `${event.type} is not allowed in ${state.status}` };
  }
  return applyValidTransition(state, event);
}
```

Part 2 notes are editable only in `part2_preparing`; `PREP_EXPIRED` locks notes. Caption toggling is allowed in every non-terminal session state and does not increment the item index.

- [x] **Step 4: Run GREEN and regression**

Run: `node --test tests/ielts-state-machine.test.mjs && npm test`  
Expected: 0 failures.

- [x] **Step 5: Inspect scoped diff**

Run: `git diff --check -- src/ielts/exam-state-machine.mjs tests/ielts-state-machine.test.mjs`.

### Task 4: Demo controller, timers, history and evidence-based feedback

**Files:**
- Create: `src/ielts/feedback.mjs`
- Create: `src/ielts/demo-controller.mjs`
- Test: `tests/ielts-demo-controller.test.mjs`

**Interfaces:**
- Consumes: `loadQuestionBank`, `assemblePaper`, `createExamState`, `transitionExam`.
- Produces: `createIeltsDemoController({ loadJson, clock, random, storage, speak, onChange })`.
- Controller methods: `openHome()`, `selectMode(mode)`, `setPreflight(patch)`, `start()`, `submitAnswer(text)`, `updateNotes(text)`, `toggleCaptions()`, `retry()`, `next()`, `exit()` and `dispose()`.
- Produces: `buildPracticeFeedback(session): FeedbackReport`.

- [x] **Step 1: Write failing controller tests**

```js
test("recording is off by default and becomes immutable after start", async () => {
  const controller = createController();
  controller.setPreflight({ recordingEnabled: true });
  await controller.start();
  assert.equal(controller.getSnapshot().sessionPolicy.recordingEnabled, true);
  assert.throws(() => controller.setPreflight({ recordingEnabled: false }), /before start/);
});

test("Part 2 notes lock after the accelerated prep deadline", async () => {
  const controller = createController({ prepSeconds: 1 });
  await startAtPart2(controller);
  controller.updateNotes("people, patience, confidence");
  controller.expirePreparationForTest();
  assert.equal(controller.getSnapshot().exam.status, "part2_answering");
  assert.equal(controller.getSnapshot().notesLocked, true);
});

test("feedback never returns a numeric IELTS score", () => {
  const report = buildPracticeFeedback(completedSessionWithoutAudio);
  assert.equal(JSON.stringify(report).includes("/9"), false);
  assert.equal(report.dimensions.pronunciation.status, "not_assessed");
});
```

- [x] **Step 2: Run RED**

Run: `node --test tests/ielts-demo-controller.test.mjs`  
Expected: missing controller/feedback modules.

- [x] **Step 3: Implement controller with injected effects**

```js
export function createIeltsDemoController(deps) {
  let snapshot = createHomeSnapshot();
  let timerId = null;
  const publish = () => deps.onChange?.(structuredClone(snapshot));
  const dispatch = (event) => {
    snapshot.exam = transitionExam(snapshot.exam, event);
    snapshot.notesLocked = snapshot.exam.status !== "part2_preparing";
    publish();
  };
  return {
    getSnapshot: () => structuredClone(snapshot),
    async start() {
      const bank = await loadQuestionBank(deps.loadJson);
      const paper = assemblePaper(bank, snapshot.assemblyOptions);
      snapshot.exam = transitionExam(createExamState(paper, snapshot.sessionPolicy), { type: "START" });
      snapshot.screen = "session";
      publish();
    },
    submitAnswer(text) {
      snapshot.answers.push(createAnswerRecord(snapshot.exam, text, deps.clock.now()));
      dispatch({ type: "SUBMIT_ANSWER" });
    },
    updateNotes(text) {
      if (snapshot.exam.status !== "part2_preparing") throw new Error("Notes are editable only during Part 2 preparation");
      snapshot.notes = text;
      publish();
    },
    toggleCaptions() {
      snapshot.sessionPolicy.captionsEnabled = !snapshot.sessionPolicy.captionsEnabled;
      publish();
    },
    dispose() {
      if (timerId) deps.clock.clearInterval(timerId);
      deps.speak.cancel?.();
    },
  };
}
```

Use injected `storage` to retain IDs from the latest five completed demo sessions. Use injected `speak(text)` so Node tests do not depend on browser speech APIs.

- [x] **Step 4: Run GREEN and regression**

Run: `node --test tests/ielts-demo-controller.test.mjs && npm test`  
Expected: 0 failures.

- [x] **Step 5: Inspect scoped diff**

Run: `git diff --check -- src/ielts/feedback.mjs src/ielts/demo-controller.mjs tests/ielts-demo-controller.test.mjs`.

### Task 5: IELTS route, views and user interactions

**Files:**
- Create: `src/views/ielts.mjs`
- Modify: `src/router.mjs`
- Modify: `src/views/scenes.mjs`
- Modify: `src/app.mjs`
- Create: `tests/ielts-view.test.mjs`
- Modify: `tests/router.test.mjs`

**Interfaces:**
- `renderIelts(snapshot): string` renders `home`, `preflight`, `session`, `report` screens.
- `#/ielts` maps to route name `ielts`; `globalSection({name:"ielts"})` returns `scenes`.
- `app.mjs` maps `data-action` values to controller methods.

- [x] **Step 1: Write failing route and view tests**

```js
test("parses the IELTS feature route", () => {
  assert.deepEqual(parseRoute("#/ielts"), { name: "ielts", params: {}, invalid: false });
  assert.equal(globalSection(parseRoute("#/ielts")), "scenes");
});

test("Part 2 renders the complete cue card and locked notes while answering", () => {
  const html = renderIelts(part2AnsweringSnapshot);
  assert.match(html, /Describe a person/);
  assert.match(html, /You should say/);
  assert.match(html, /and explain/);
  assert.match(html, /textarea[^>]+readonly/);
});

test("full mock Part 1 hides the question card while captions are off", () => {
  const html = renderIelts(fullMockPart1Snapshot);
  assert.doesNotMatch(html, /data-current-question/);
});
```

- [x] **Step 2: Run RED**

Run: `node --test tests/router.test.mjs tests/ielts-view.test.mjs`  
Expected: route assertion fails and view module is missing.

- [x] **Step 3: Implement route, semantic views and actions**

Actions must include `ielts-select-mode`, `ielts-toggle-recording`, `ielts-start`, `ielts-toggle-captions`, `ielts-submit-answer`, `ielts-update-notes`, `ielts-retry`, `ielts-next`, `ielts-exit` and `ielts-restart`.

The session footer button is labelled `模拟完成本轮回答` and represents a future VAD `turn.end` event; it is not labelled skip. A visible `DEMO 加速模式` badge explains the reduced question count and shortened prep timer.

- [x] **Step 4: Run GREEN and regression**

Run: `node --test tests/router.test.mjs tests/ielts-view.test.mjs && npm test`  
Expected: 0 failures.

- [x] **Step 5: Inspect scoped diff**

Run: `git diff --check -- src/router.mjs src/views/scenes.mjs src/views/ielts.mjs src/app.mjs tests/router.test.mjs tests/ielts-view.test.mjs`.

### Task 6: Responsive IELTS visual system, docs and full verification

**Files:**
- Modify: `styles.css`
- Modify: `README.md`
- Modify: `tests/static-ui.test.mjs`

**Interfaces:**
- `.ielts-*` selectors are isolated from existing training and conversation layouts.
- Desktop uses full-width cue card with notes/status below; mobile preserves the cue-card-first reading order.

- [x] **Step 1: Write failing static quality test**

```js
test("IELTS demo keeps the cue card first and exposes responsive controls", async () => {
  const [view, css] = await Promise.all([read("src/views/ielts.mjs"), read("styles.css")]);
  assert.match(view, /ielts-cue-card/);
  assert.match(view, /DEMO 加速模式/);
  assert.match(css, /\.ielts-cue-card/);
  assert.match(css, /@media\s*\(max-width:\s*760px\)[\s\S]*\.ielts-/);
  assert.match(css, /\.ielts-[^{]+:focus-visible/);
});
```

- [x] **Step 2: Run RED**

Run: `node --test tests/static-ui.test.mjs`  
Expected: FAIL because `.ielts-*` styles do not exist.

- [x] **Step 3: Add isolated styles and README instructions**

Styles must cover home cards, preflight policy switches, stage/timer header, full-width cue card, note panel, microphone/turn state, captions, report dimensions and mobile stacking. README must state:

```markdown
## IELTS Speaking Demo

Run `npm run dev`, open `http://localhost:8080/#/ielts`, and choose a mode.
The Demo uses browser speech synthesis and a manual VAD substitute; it does not call the production Realtime provider.
Part 2 preparation is accelerated for demonstration while the domain default remains 60 seconds.
```

- [x] **Step 4: Run complete automated verification**

Run: `npm test`  
Expected: all tests PASS, 0 failures.

Run: `node --check src/app.mjs && for file in src/ielts/*.mjs src/views/ielts.mjs; do node --check "$file"; done`  
Expected: all commands exit 0.

Run: `git diff --check -- 7.14/UniSpeaking_Complete_UI` from repository root.  
Expected: exit 0.

- [x] **Step 5: Run browser acceptance**

Start: `npm run dev`  
Open: `http://localhost:8080/#/ielts`

Verify:

1. Scene plaza IELTS button reaches the Demo.
2. Full mock preflight shows captions off and recording off.
3. Part 1 full mock hides the question card until captions are enabled.
4. Part 2 shows topic sentence, all bullets and `and explain`; notes are editable only during prep.
5. Full mock has no pause, retry or skip buttons.
6. Part 3 uses the same topic cluster as Part 2.
7. Completing the session produces evidence-based feedback with no numeric IELTS score.
8. At 390px viewport width the cue card remains first, controls have 44px hit areas and no horizontal overflow occurs.

- [x] **Step 6: Update planning records and report changed files**

Mark Phase 37 complete only after fresh test, syntax, diff and browser evidence all pass. Do not include unrelated root changes in the handoff.
