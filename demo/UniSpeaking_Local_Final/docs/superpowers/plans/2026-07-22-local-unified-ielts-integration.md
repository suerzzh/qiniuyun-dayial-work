# UniSpeaking Local Unified IELTS Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one clean local project with the existing React product UI, a fully React-based IELTS Part 1/2/3 flow, one Spring Boot backend, the existing four official IELTS-style dimensions, and a separate fifth UniSpeaking training dimension.

**Architecture:** Copy the reviewed React and Spring Boot baselines into `UniSpeaking_Local_Final`, then port only the pure IELTS browser modules and rebuild their views as React components. The browser talks to Spring Boot through Vite's same-origin HTTP/WebSocket proxy; Java remains authoritative for report validation, four-band Overall calculation, the task-achievement diagnostic, and radar normalization.

**Tech Stack:** React 18, Vite 5, JavaScript/JSX, Node test runner, Vitest + Testing Library, Spring Boot 3.3.1, Java 21, JUnit 5, Spring MockMvc, Qwen Realtime/Qwen compatible API, iFlytek ISE.

## Global Constraints

- Final project path is `/Users/mac/Documents/七牛云/demo/UniSpeaking_Local_Final`.
- Frontend listens on `127.0.0.1:8080`; backend listens on `127.0.0.1:8000`.
- The four source directories remain unchanged and are not deleted.
- Supabase and Vercel are not runtime or build dependencies of the final project.
- Sessions, attempts, PCM, transcripts, evidence, and reports remain in Java process memory and disappear on restart.
- IELTS Overall uses only FC, LR, GRA, and Pronunciation with equal weights and nearest-0.5 rounding.
- Task Achievement / Interaction Response is an integer `0–100` product diagnostic and never changes Overall.
- Missing dimensions remain `null`; they are never rendered or calculated as zero.
- No real credential may enter frontend source, tests, Git, or build output.
- All new or changed behavior follows red-green-refactor and every completion claim requires fresh verification output.

---

## File Structure Map

### Frontend

- `frontend/src/App.jsx`: product route composition only.
- `frontend/src/router.mjs`: hash-route parsing and global-section mapping.
- `frontend/src/views/ScenesView.jsx`: IELTS product entry.
- `frontend/src/views/IeltsView.jsx`: IELTS screen composition and controller subscription.
- `frontend/src/components/ielts/IeltsHome.jsx`: mode selection.
- `frontend/src/components/ielts/IeltsPreflight.jsx`: local backend and microphone preflight.
- `frontend/src/components/ielts/IeltsExamStage.jsx`: shared Part 1/2/3 exam frame.
- `frontend/src/components/ielts/IeltsPart2Card.jsx`: cue card and preparation notes.
- `frontend/src/components/ielts/IeltsReportView.jsx`: official four-dimension report and report states.
- `frontend/src/components/ielts/FiveDimensionRadar.jsx`: SVG radar rendering only.
- `frontend/src/hooks/useIeltsSession.js`: controller/runtime ownership and idempotent disposal.
- `frontend/src/ielts/*.mjs`: framework-independent question bank, paper, state machine, PCM, runtime, and report mapping.
- `frontend/src/services/ielts-api.mjs`: local Java Attempt API.
- `frontend/src/services/local-service-config.mjs`: same-origin HTTP/WS resolution.
- `frontend/public/ielts/question-bank/*.json`: immutable runtime question bank.
- `frontend/styles.css`: existing product CSS plus namespaced `.ielts-*` rules.

### Backend

- `backend/src/main/java/com/example/unispeaking/model/ielts/TaskAchievementResult.java`: fifth-dimension result.
- `backend/src/main/java/com/example/unispeaking/model/ielts/RadarDimension.java`: normalized radar item.
- `backend/src/main/java/com/example/unispeaking/model/ielts/IeltsReport.java`: compatible report plus normalized fields.
- `backend/src/main/java/com/example/unispeaking/service/ielts/IeltsRadarMapper.java`: deterministic `0–100` mapping.
- `backend/src/main/java/com/example/unispeaking/service/ielts/IeltsScoringOrchestrator.java`: fifth-dimension parsing and report assembly.
- `backend/src/main/resources/prompts/ielts/judge.txt`: structured fifth-dimension output contract.
- `backend/src/main/java/com/example/unispeaking/controller/ScoringController.java`: safe health capability flags.

### Root

- `.env.example`: server-only configuration names.
- `.gitignore`: credentials, dependencies, logs, PIDs, caches, and build output.
- `scripts/start-local.sh`: start and health-check exactly these two local processes.
- `scripts/stop-local.sh`: stop only PIDs written by `start-local.sh`.
- `README.md`: prerequisites, setup, operation, limitations, and verification.

---

### Task 1: Assemble the Clean Baseline

**Files:**
- Create: `frontend/**` from `demo/UniSpeaking_React` excluding deployment/cached artifacts
- Create: `backend/**` from `demo/demo_freechat_scoring/backend_java`
- Create: `.gitignore`
- Preserve: `docs/superpowers/**`

**Interfaces:**
- Consumes: the three reviewed source projects.
- Produces: independently testable React and Spring Boot baselines under the final directory.

- [ ] **Step 1: Record the source manifests before copying**

Run:

```bash
git status --short -- demo
find demo/UniSpeaking_React -maxdepth 1 -type f -print | sort
find demo/demo_freechat_scoring/backend_java -maxdepth 1 -type f -print | sort
```

Expected: source directories are visible and no command changes them.

- [ ] **Step 2: Copy the React and Java baselines with explicit exclusions**

Run from `/Users/mac/Documents/七牛云`:

```bash
rsync -a \
  --exclude '.git' --exclude '.vercel' --exclude '.vite' --exclude 'dist' \
  --exclude 'acceptance' --exclude '.planning' --exclude 'docs' \
  --exclude '.env*' --exclude '.DS_Store' \
  demo/UniSpeaking_React/ demo/UniSpeaking_Local_Final/frontend/
rsync -a \
  --exclude '.git' --exclude '.m2' --exclude '.run' --exclude '.env*' --exclude '.DS_Store' \
  demo/demo_freechat_scoring/backend_java/ demo/UniSpeaking_Local_Final/backend/
```

Expected: `frontend/package.json` and `backend/pom.xml` exist; `docs/superpowers` remains intact.

- [ ] **Step 3: Add root ignore rules**

Create `.gitignore` with exactly these project-local rules:

```gitignore
.env
.run/
*.log
*.pid
.DS_Store
frontend/node_modules/
frontend/dist/
frontend/.vite/
backend/target/
backend/.mvn/wrapper/maven-wrapper.jar
```

- [ ] **Step 4: Delete copied deployment-only files from the final project**

Use an `apply_patch` deletion for these exact targets if present:

```text
frontend/vercel.json
frontend/.env.example
frontend/walkthrough.md
frontend/tests/realtime-gateway-contract.test.mjs
```

`realtime-gateway-contract.test.mjs` is deployment-specific because every assertion reads the excluded Supabase Edge Function. Java API regression tests remain the authoritative local gateway contract. Expected: no `vercel.json`, `supabase/`, `.vercel/`, `dist/`, `.vite/`, or acceptance image directory exists below `UniSpeaking_Local_Final`.

- [ ] **Step 5: Verify both copied baselines before feature changes**

Run:

```bash
cd demo/UniSpeaking_Local_Final/frontend
npm ci
npm run lint
npm run typecheck
npm test
npm run build
cd ../backend
./mvnw test
```

Expected: all baseline checks exit `0`.

- [ ] **Step 6: Commit the clean baseline**

```bash
git add demo/UniSpeaking_Local_Final/frontend demo/UniSpeaking_Local_Final/backend demo/UniSpeaking_Local_Final/.gitignore
git commit -m "chore: assemble clean local UniSpeaking baseline"
```

---

### Task 2: Add Deterministic Fifth-Dimension Models and Radar Mapping

**Files:**
- Create: `backend/src/main/java/com/example/unispeaking/model/ielts/TaskAchievementResult.java`
- Create: `backend/src/main/java/com/example/unispeaking/model/ielts/RadarDimension.java`
- Create: `backend/src/main/java/com/example/unispeaking/service/ielts/IeltsRadarMapper.java`
- Test: `backend/src/test/java/com/example/unispeaking/service/ielts/IeltsRadarMapperTest.java`

**Interfaces:**
- Consumes: `IeltsDimensionResult.band(): Double`.
- Produces: `TaskAchievementResult.validate(Integer)`, `TaskAchievementResult.unavailable(String)`, and `IeltsRadarMapper.map(IeltsDimensionResult, IeltsDimensionResult, IeltsDimensionResult, IeltsDimensionResult, TaskAchievementResult) -> List<RadarDimension>`.

- [ ] **Step 1: Write the failing mapper tests**

```java
class IeltsRadarMapperTest {
    private final IeltsRadarMapper mapper = new IeltsRadarMapper();

    @Test void normalizesOfficialBandsAndKeepsTaskScore() {
        var radar = mapper.map(dimension(6.5), dimension(6.0), dimension(6.5), dimension(7.0),
                new TaskAchievementResult(82, 0.78, List.of("切题"), List.of(), null));
        assertEquals(List.of(72, 67, 72, 78, 82), radar.stream().map(RadarDimension::score).toList());
        assertEquals(List.of("FC", "LR", "GRA", "P", "TA"), radar.stream().map(RadarDimension::code).toList());
    }

    @Test void missingDimensionRemainsNullInsteadOfZero() {
        var radar = mapper.map(dimension(6.5), dimension(6.0), dimension(6.5),
                IeltsDimensionResult.unavailable("P", "missing"), TaskAchievementResult.unavailable("missing"));
        assertNull(radar.get(3).score());
        assertNull(radar.get(4).score());
    }

    @Test void rejectsNonIntegerOrOutOfRangeTaskScores() {
        assertThrows(IllegalArgumentException.class, () -> TaskAchievementResult.validate(-1));
        assertThrows(IllegalArgumentException.class, () -> TaskAchievementResult.validate(101));
    }

    private static IeltsDimensionResult dimension(double band) {
        return new IeltsDimensionResult("X", band, 0.8, List.of(), List.of(), null);
    }
}
```

- [ ] **Step 2: Run the test and verify RED**

Run: `cd backend && ./mvnw -Dtest=IeltsRadarMapperTest test`

Expected: compilation fails because the three new production types do not exist.

- [ ] **Step 3: Implement the minimal records and mapper**

Use these exact public shapes:

```java
public record TaskAchievementResult(
        Integer score, Double confidence, List<String> positiveEvidence,
        List<String> limitingEvidence, String unavailableReason) {
    public TaskAchievementResult {
        validate(score);
        positiveEvidence = positiveEvidence == null ? List.of() : List.copyOf(positiveEvidence);
        limitingEvidence = limitingEvidence == null ? List.of() : List.copyOf(limitingEvidence);
    }
    public static void validate(Integer score) {
        if (score != null && (score < 0 || score > 100))
            throw new IllegalArgumentException("task achievement score must be an integer from 0 to 100");
    }
    public static TaskAchievementResult unavailable(String reason) {
        return new TaskAchievementResult(null, null, List.of(), List.of(), reason);
    }
}
```

```java
public record RadarDimension(String code, String label, Integer score) {}
```

Implement the mapper as:

```java
public class IeltsRadarMapper {
    public List<RadarDimension> map(IeltsDimensionResult fc, IeltsDimensionResult lr,
                                    IeltsDimensionResult gra, IeltsDimensionResult pronunciation,
                                    TaskAchievementResult taskAchievement) {
        return List.of(
                new RadarDimension("FC", "流利度与连贯性", bandScore(fc)),
                new RadarDimension("LR", "词汇资源", bandScore(lr)),
                new RadarDimension("GRA", "语法多样性与准确性", bandScore(gra)),
                new RadarDimension("P", "发音", bandScore(pronunciation)),
                new RadarDimension("TA", "任务完成度/互动回应", taskAchievement.score()));
    }

    private Integer bandScore(IeltsDimensionResult dimension) {
        return dimension == null || dimension.band() == null
                ? null : (int) Math.round(dimension.band() / 9.0 * 100.0);
    }
}
```

- [ ] **Step 4: Run RED to GREEN and the backend regression suite**

Run:

```bash
cd backend
./mvnw -Dtest=IeltsRadarMapperTest test
./mvnw test
```

Expected: both commands exit `0`; existing four-band tests remain green.

- [ ] **Step 5: Commit**

```bash
git add demo/UniSpeaking_Local_Final/backend/src
git commit -m "feat: add IELTS fifth-dimension radar mapping"
```

---

### Task 3: Extend the Java IELTS Report Without Changing Overall

**Files:**
- Modify: `backend/src/main/java/com/example/unispeaking/model/ielts/IeltsReport.java`
- Modify: `backend/src/main/java/com/example/unispeaking/service/ielts/IeltsScoringOrchestrator.java`
- Modify: `backend/src/main/resources/prompts/ielts/judge.txt`
- Modify: `backend/src/test/java/com/example/unispeaking/service/ielts/IeltsScoringOrchestratorTest.java`
- Modify: `backend/src/test/java/com/example/unispeaking/IeltsAttemptControllerTest.java`

**Interfaces:**
- Consumes: Judge key `task_achievement` with `score`, `confidence`, `positive_evidence`, and `limiting_evidence`.
- Produces: report accessors `officialDimensions()`, `taskAchievement()`, and `radarDimensions()` while preserving `fc()`, `lr()`, `gra()`, and `pronunciation()`.

- [ ] **Step 1: Add failing orchestrator assertions**

Extend `validJudge()` with:

```java
"task_achievement", Map.of(
    "score", 82,
    "confidence", 0.78,
    "positive_evidence", List.of("回答覆盖题目要求"),
    "limiting_evidence", List.of("部分观点缺少例子"))
```

Add tests that assert:

```java
assertEquals(82, report.taskAchievement().score());
assertEquals(5, report.radarDimensions().size());
assertEquals(6.5, report.overallBand());
assertEquals(report.fc(), report.officialDimensions().get("fluencyCoherence"));
```

Create a second judge with task score `25` and assert that `overallBand()` is still `6.5`.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `cd backend && ./mvnw -Dtest=IeltsScoringOrchestratorTest test`

Expected: compilation fails because the new report accessors do not exist.

- [ ] **Step 3: Extend `IeltsReport` and orchestrator assembly**

Append these record components after `pronunciation`:

```java
Map<String, IeltsDimensionResult> officialDimensions,
TaskAchievementResult taskAchievement,
List<RadarDimension> radarDimensions,
```

Implement `taskAchievement(Object raw, List<String> warnings)` so that only an integral Java `Number` in `0–100` is accepted:

```java
private TaskAchievementResult taskAchievement(Object raw, List<String> warnings) {
    Map<String, Object> map = asMap(raw);
    Object rawScore = map.get("score");
    if (!(rawScore instanceof Number number)
            || !Double.isFinite(number.doubleValue())
            || number.doubleValue() != Math.rint(number.doubleValue())) {
        warnings.add("TA score 缺失或不是 0–100 整数，已标记 unavailable");
        return TaskAchievementResult.unavailable("千问未返回有效的任务完成度分数");
    }
    int score = number.intValue();
    try {
        TaskAchievementResult.validate(score);
    } catch (IllegalArgumentException error) {
        warnings.add("TA score 超出 0–100，已标记 unavailable");
        return TaskAchievementResult.unavailable("任务完成度分数超出有效范围");
    }
    return new TaskAchievementResult(score, nullableNumber(map.get("confidence")),
            strings(map.get("positive_evidence")), strings(map.get("limiting_evidence")), null);
}
```

Build `officialDimensions` as an insertion-ordered unmodifiable map with stable keys `fluencyCoherence`, `lexicalResource`, `grammaticalRangeAccuracy`, and `pronunciation`. Use `IeltsRadarMapper` for all reports, including partial and unscorable reports.

- [ ] **Step 4: Tighten the Judge prompt contract**

Add this required JSON member to `judge.txt`:

```json
"task_achievement": {
  "score": 0,
  "confidence": 0.0,
  "positive_evidence": ["基于原始回答的中文证据"],
  "limiting_evidence": ["基于原始回答的中文限制"]
}
```

State in the prompt that `score` is an integer from `0` to `100`, measures relevance/coverage/development/response to follow-ups, and must not be used in IELTS Overall.

- [ ] **Step 5: Add controller JSON contract assertions**

For a completed fake report, assert JSON paths:

```java
jsonPath("$.officialDimensions.fluencyCoherence.band").value(6.5)
jsonPath("$.taskAchievement.score").value(82)
jsonPath("$.radarDimensions[4].code").value("TA")
jsonPath("$.radarDimensions[4].score").value(82)
```

- [ ] **Step 6: Run backend tests and commit**

```bash
cd backend
./mvnw test
git add src
git commit -m "feat: return official and five-dimension IELTS reports"
```

Expected: all tests pass and the four-band calculator file is unchanged.

---

### Task 4: Characterize and Port the IELTS Browser Runtime

**Files:**
- Create: `frontend/src/ielts/{demo-controller,exam-state-machine,examiner-prompt-catalog,feedback,ielts-session-runtime,paper-assembler,pcm-scoring-streamer,question-bank,speech-recognition-adapter,voice-answer-controller}.mjs`
- Create: `frontend/src/services/ielts-api.mjs`
- Create: `frontend/public/ielts/question-bank/{manifest,part1,part2_part3}.json`
- Create: `frontend/tests/ielts-*.test.mjs`

**Interfaces:**
- Consumes: reviewed modules and tests from `UniSpeaking_Complete_UI`.
- Produces: the same framework-independent exports under the React project.

- [ ] **Step 1: Copy the existing IELTS Node tests before production modules**

Copy the reviewed `ielts-*.test.mjs` files from `UniSpeaking_Complete_UI/tests` into `frontend/tests`, excluding only the legacy `ielts-view.test.mjs` because the view is being replaced by React tests.

- [ ] **Step 2: Run tests and verify RED**

Run: `cd frontend && npm test`

Expected: IELTS tests fail with module-not-found errors for `src/ielts` and `src/services/ielts-api.mjs`.

- [ ] **Step 3: Copy the reviewed pure production modules and API adapter**

Copy the ten exact `.mjs` modules listed in **Files** plus `src/services/ielts-api.mjs`. Do not copy `src/views/ielts.mjs`, `src/app.mjs`, `index.html`, or legacy IELTS CSS.

- [ ] **Step 4: Copy the immutable runtime question bank**

Copy:

```text
UniSpeaking_Complete_UI/backend/ielts/question_bank/manifest.json
UniSpeaking_Complete_UI/backend/ielts/question_bank/part1.json
UniSpeaking_Complete_UI/backend/ielts/question_bank/part2_part3.json
```

to `frontend/public/ielts/question-bank/` and configure the controller loader as:

```js
const loadJson = async (name) => {
  const response = await fetch(`/ielts/question-bank/${name}`);
  if (!response.ok) throw new Error(`题库加载失败（${response.status}）`);
  return response.json();
};
```

- [ ] **Step 5: Run the complete frontend Node suite**

Run: `cd frontend && npm test`

Expected: all old React-product tests and all ported IELTS logic tests pass.

- [ ] **Step 6: Commit**

```bash
git add demo/UniSpeaking_Local_Final/frontend/src/ielts demo/UniSpeaking_Local_Final/frontend/src/services/ielts-api.mjs demo/UniSpeaking_Local_Final/frontend/public demo/UniSpeaking_Local_Final/frontend/tests
git commit -m "feat: port IELTS exam runtime into React project"
```

---

### Task 5: Configure One Same-Origin Local Java API

**Files:**
- Create: `frontend/src/services/local-service-config.mjs`
- Modify: `frontend/src/services/realtime-api.mjs`
- Modify: `frontend/src/services/ielts-api.mjs`
- Modify: `frontend/src/ielts/ielts-session-runtime.mjs`
- Modify: `frontend/src/hooks/useRealtimeSession.js`
- Modify: `frontend/vite.config.js`
- Test: `frontend/tests/local-service-config.test.mjs`
- Test: `frontend/tests/realtime-api.test.mjs`
- Test: `frontend/tests/ielts-api.test.mjs`
- Test: `frontend/tests/ielts-session-runtime.test.mjs`

**Interfaces:**
- Produces: `resolveHttpBase(origin) -> string` and `resolveWsBase(origin) -> string`.
- All browser API calls use the current Vite origin; Vite proxies to `http://127.0.0.1:8000`.

- [ ] **Step 1: Write failing service-resolution tests**

```js
test("resolves same-origin HTTP and WebSocket bases", () => {
  assert.equal(resolveHttpBase("http://127.0.0.1:8080"), "http://127.0.0.1:8080");
  assert.equal(resolveWsBase("http://127.0.0.1:8080"), "ws://127.0.0.1:8080");
  assert.equal(resolveWsBase("https://local.example"), "wss://local.example");
});
```

- [ ] **Step 2: Run and verify RED**

Run: `cd frontend && node --test tests/local-service-config.test.mjs`

Expected: module-not-found for `local-service-config.mjs`.

- [ ] **Step 3: Implement service resolution and Vite proxy**

```js
export function resolveHttpBase(origin = globalThis.location?.origin) {
  if (!origin) throw new Error("无法确定本地服务地址");
  return new URL(origin).origin;
}
export function resolveWsBase(origin = globalThis.location?.origin) {
  const url = new URL(resolveHttpBase(origin));
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.origin;
}
```

Add to `vite.config.js`:

```js
proxy: {
  "/api": { target: "http://127.0.0.1:8000", changeOrigin: true, ws: true },
  "/health": { target: "http://127.0.0.1:8000", changeOrigin: true },
}
```

Remove publishable-key behavior from the final realtime adapter. Keep the Java paths `/api/sessions`, `/api/realtime`, `/api/sessions/{id}/events`, `/api/sessions/{id}/quality`, and `DELETE /api/sessions/{id}`.

Remove `VITE_REALTIME_API_BASE` and `VITE_SUPABASE_PUBLISHABLE_KEY` reads from `useRealtimeSession`; create the adapter without legacy deployment options. In `ielts-session-runtime.mjs`, resolve relative scoring WebSocket paths against `resolveWsBase()` so the browser uses `ws(s)://<current-vite-origin>/api/ielts/scoring-stream` and Vite performs the WebSocket proxying. Add a runtime test that captures the URL passed to `streamer.attach` and asserts it uses the supplied/current Vite WebSocket origin rather than port `8000`.

- [ ] **Step 4: Run API contract tests and commit**

```bash
cd frontend
npm test
npm run typecheck
git add src/services vite.config.js tests
git commit -m "feat: route browser services through local Java"
```

Expected: requests contain no `apikey` header and WebSocket URLs use the Vite origin.

---

### Task 6: Build the Five-Dimension React Report

**Files:**
- Create: `frontend/src/ielts/report-model.mjs`
- Create: `frontend/src/components/ielts/FiveDimensionRadar.jsx`
- Create: `frontend/src/components/ielts/IeltsReportView.jsx`
- Create: `frontend/tests/ielts-report-model.test.mjs`
- Create: `frontend/tests/ielts-report-view.test.jsx`
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`
- Modify: `frontend/tsconfig.json`

**Interfaces:**
- Consumes: Java `IeltsReport` JSON.
- Produces: `normalizeIeltsReport(raw)` and accessible report markup.

- [ ] **Step 1: Install the React test harness**

Run:

```bash
cd frontend
npm install --save-dev vite@8.1.5 @vitejs/plugin-react@6.0.4 vitest@4.1.10 jsdom@29.1.1 @testing-library/react@16.3.2 @testing-library/jest-dom@7.0.0
```

Set `test` to run both suites:

```json
"test": "node --test tests/*.test.mjs && vitest run"
```

- [ ] **Step 2: Write failing model tests**

Test that `normalizeIeltsReport`:

```js
assert.equal(report.overallBand, 6.5);
assert.deepEqual(report.radarDimensions.map((item) => item.score), [72, 67, 72, 78, 82]);
assert.equal(report.radarComplete, true);
assert.equal(normalizeIeltsReport({ radarDimensions: [{ code: "P", score: null }] }).radarComplete, false);
```

Also assert that absent normalized fields are derived from legacy `fc`, `lr`, `gra`, and `pronunciation` fields without coercing null to zero.

- [ ] **Step 3: Run model tests and verify RED**

Run: `cd frontend && node --test tests/ielts-report-model.test.mjs`

Expected: module-not-found for `report-model.mjs`.

- [ ] **Step 4: Implement the report model**

Expose the complete normalization algorithm:

```js
export function bandToRadarScore(band) {
  return Number.isFinite(band) ? Math.round(Number(band) / 9 * 100) : null;
}

const AXES = [
  ["FC", "流利度与连贯性", "fluencyCoherence", "fc"],
  ["LR", "词汇资源", "lexicalResource", "lr"],
  ["GRA", "语法多样性与准确性", "grammaticalRangeAccuracy", "gra"],
  ["P", "发音", "pronunciation", "pronunciation"],
];

export function normalizeIeltsReport(raw = {}) {
  const suppliedOfficial = raw.officialDimensions || {};
  const officialDimensions = Object.fromEntries(AXES.map(([, , key, legacy]) => [
    key,
    suppliedOfficial[key] || raw[legacy] || { band: null, unavailableReason: "暂无可用证据" },
  ]));
  const taskAchievement = raw.taskAchievement || {
    score: null, confidence: null, positiveEvidence: [], limitingEvidence: [],
    unavailableReason: "任务完成度暂不可用",
  };
  const suppliedRadar = new Map((raw.radarDimensions || []).map((item) => [item.code, item]));
  const radarDimensions = [
    ...AXES.map(([code, label, key]) => suppliedRadar.get(code) || {
      code, label, score: bandToRadarScore(officialDimensions[key]?.band),
    }),
    suppliedRadar.get("TA") || {
      code: "TA", label: "任务完成度/互动回应", score: taskAchievement.score ?? null,
    },
  ].map((item) => ({ ...item, score: Number.isFinite(item.score) ? Number(item.score) : null }));
  return {
    overallBand: raw.overallBand ?? raw.overall_band ?? null,
    scoringStatus: raw.scoringStatus ?? raw.scoring_status ?? "PARTIAL",
    officialDimensions,
    taskAchievement,
    radarDimensions,
    radarComplete: radarDimensions.every((item) => Number.isFinite(item.score)),
    bandRange: raw.bandRange ?? raw.band_range ?? [],
    confidence: raw.confidence ?? null,
    partSummaries: raw.partSummaries ?? raw.part_summaries ?? {},
    warnings: raw.dataQualityWarnings ?? raw.data_quality_warnings ?? [],
    disclaimer: raw.disclaimer ?? "",
  };
}
```

The implementation must use `?? null`, never `|| 0`, for scores. Extend `tsconfig.json` so `src/ielts/**/*.mjs` and `src/components/ielts/**/*.jsx` are covered by `npm run typecheck`.

- [ ] **Step 5: Write failing React report tests**

Using Testing Library, assert:

```jsx
render(<IeltsReportView report={completeReport} onRestart={() => {}} />);
expect(screen.getByRole("heading", { name: /Overall 6.5/ })).toBeInTheDocument();
expect(screen.getByRole("img", { name: /五维训练诊断/ })).toBeInTheDocument();
expect(screen.getByText("任务完成度/互动回应")).toBeInTheDocument();
expect(screen.getByText(/不属于 IELTS 官方评分项/)).toBeInTheDocument();
```

For partial data, assert the UI contains `部分诊断` and `不可用` and does not display `0` for a null dimension.

- [ ] **Step 6: Implement accessible SVG radar and official cards**

`FiveDimensionRadar` receives `{ dimensions, complete }`, normalizes input against the fixed canonical codes `FC`, `LR`, `GRA`, `P`, and `TA`, calculates five fixed axis points even when an item is omitted, renders grid/spokes/labels, and renders a polygon only when all five scores are finite. It always exposes an `aria-label` containing each available score and each unavailable axis.

`IeltsReportView` renders Overall, band range, confidence, four official cards, task-achievement evidence, Part summaries, warnings, disclaimer, and restart/retry actions. It labels the radar section `UniSpeaking 五维训练诊断` and displays `任务完成度/互动回应不属于 IELTS 官方评分项，也不参与 Overall`. Evidence heading levels must follow their containing section without skipping levels. Partial-report tests must explicitly reject `Overall 0`, `Band 0`, and `0 / 100` for unavailable values.

- [ ] **Step 7: Run RED to GREEN and commit**

```bash
cd frontend
npm test
npm run lint
npm run typecheck
npm audit --audit-level=high
git add package.json package-lock.json src/ielts/report-model.mjs src/components/ielts tests
git commit -m "feat: render official IELTS report with five-dimension radar"
```

---

### Task 7: Build the React IELTS Flow and Resource Owner Hook

**Files:**
- Create: `frontend/src/hooks/useIeltsSession.js`
- Create: `frontend/src/views/IeltsView.jsx`
- Create: `frontend/src/components/ielts/IeltsHome.jsx`
- Create: `frontend/src/components/ielts/IeltsPreflight.jsx`
- Create: `frontend/src/components/ielts/IeltsExamStage.jsx`
- Create: `frontend/src/components/ielts/IeltsPart2Card.jsx`
- Create: `frontend/tests/use-ielts-session.test.jsx`
- Create: `frontend/tests/ielts-flow.test.jsx`
- Modify: `frontend/src/ielts/demo-controller.mjs`
- Modify: `frontend/src/ielts/ielts-session-runtime.mjs`
- Modify: `frontend/tests/ielts-demo-controller.test.mjs`
- Modify: `frontend/tests/ielts-session-runtime.test.mjs`
- Modify: `frontend/tsconfig.json`

**Interfaces:**
- `useIeltsSession(options)` returns `{ snapshot, actions, serviceHealth }`.
- `actions` contains `selectMode`, `setPreflight`, `start`, `submitAnswer`, `updateNotes`, `toggleCaptions`, `retry`, `next`, `exit`, `restart`, and `retryReport`.
- `actions.start` is single-flight; `actions.restart` first tears down the prior local/server session before returning home.

- [ ] **Step 1: Write the failing ownership test**

Render a hook harness with fake controller/runtime resources, unmount it twice under React Strict Mode, and assert:

```js
expect(runtime.stop).toHaveBeenCalledTimes(1);
expect(controller.dispose).toHaveBeenCalledTimes(1);
```

Also assert `retryReport` calls `api.report(existingAttemptId)` without calling `api.finalize` or `api.createAttempt`.

Add lifecycle tests proving: two calls to `actions.start` share one in-flight controller start; unmount during an unresolved start performs another teardown after the start settles so no newly acquired resource survives; restart waits for runtime teardown and deletes/abandons the previous Attempt before returning home; report-retry continuations cannot update state after cleanup begins.

- [ ] **Step 2: Run and verify RED**

Run: `cd frontend && npx vitest run tests/use-ielts-session.test.jsx`

Expected: import failure because `useIeltsSession.js` does not exist.

- [ ] **Step 3: Implement the hook as the single resource owner**

The hook creates exactly one PCM streamer, one IELTS API, one runtime, and one demo controller per mounted route. Subscribe through the controller `onChange` callback. Store the latest Attempt ID for report retries. Guard cleanup with a closure-local boolean:

```js
let disposed = false;
return () => {
  if (disposed) return;
  disposed = true;
  controller.dispose();
};
```

Track the in-flight start promise. On unmount, immediately stop publishing, request disposal, and attach a final teardown to any pending start so resources acquired after the first cleanup are also closed. Loading UI must not expose a second Start/Retry action. `retryReport` must require both `acceptingChanges` and `!disposed` before every state update. Report recovery exits through the safe restart/home action rather than the terminal exam `exit` transition.

Make controller disposal return/await its runtime stop promise so Hook cleanup is serialized rather than overlapping `stop` and `abandon`. Perform server Attempt abandonment/deletion separately after local disposal. Runtime `finalize()` must capture the current Attempt ID in an immutable local before its first await and use that ID for finalize/report polling. The demo controller must fence finalize callbacks with a session generation so an old report cannot mutate or publish a restarted/new session. Add real controller/runtime regression tests for deferred finalize → restart → new start, in addition to Hook mocks. Loading-state Exit must always use the teardown-aware restart path.

Remove `@ts-nocheck` from all Task 7 production files, include them in `tsconfig.json`, and resolve strict `checkJs` errors with focused JSDoc types rather than weakening compiler options.

Preflight health calls `/health` and maps missing provider flags to Chinese capability messages without exposing environment values.

- [ ] **Step 4: Write failing screen-flow tests**

Using a fake hook result, assert:

- home exposes full mock and Part practice choices;
- preflight exposes microphone/service state and accelerated-Demo switch;
- Part 2 preparation renders the complete cue card and editable notes;
- Part 2 answering locks notes and exposes explicit `结束本轮回答`;
- report screen delegates to `IeltsReportView`;
- loading/error states retain a retry or exit action.

- [ ] **Step 5: Implement React screens with no manual DOM mutation**

`IeltsView` switches on `snapshot.screen` only. Child components receive plain data and callbacks; none calls `document.querySelector`, assigns `innerHTML`, or owns media resources. `IeltsExamStage` renders the current question, status, timers, transcript/captions, answer controls, Part progress, and the Part 2 card when applicable.

- [ ] **Step 6: Run focused and full frontend tests**

```bash
cd frontend
npx vitest run tests/use-ielts-session.test.jsx tests/ielts-flow.test.jsx
npm test
npm run lint
npm run typecheck
```

Expected: all commands exit `0` with no React act warnings.

- [ ] **Step 7: Commit**

```bash
git add demo/UniSpeaking_Local_Final/frontend/src/hooks/useIeltsSession.js demo/UniSpeaking_Local_Final/frontend/src/views/IeltsView.jsx demo/UniSpeaking_Local_Final/frontend/src/components/ielts demo/UniSpeaking_Local_Final/frontend/tests
git commit -m "feat: add React IELTS exam flow"
```

---

### Task 8: Integrate IELTS Into the Product Router and Styles

**Files:**
- Modify: `frontend/src/router.mjs`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/views/ScenesView.jsx`
- Modify: `frontend/styles.css`
- Modify: `frontend/tests/router.test.mjs`
- Modify: `frontend/tests/static-ui.test.mjs`

**Interfaces:**
- Produces: `#/ielts` route in the `scenes` global section.
- The IELTS scene button navigates directly to `#/ielts` without membership redirect.

- [ ] **Step 1: Write failing route and source-contract tests**

```js
assert.deepEqual(parseRoute("#/ielts"), { name: "ielts", params: {}, invalid: false });
assert.equal(routeHref("ielts"), "#/ielts");
assert.equal(globalSection("ielts"), "scenes");
```

Static assertions require `ScenesView.jsx` to contain `#/ielts`, `App.jsx` to import/render `IeltsView`, and `styles.css` to contain `.ielts-page`, `.ielts-radar`, and a `max-width:760px` IELTS rule.

- [ ] **Step 2: Run and verify RED**

Run: `cd frontend && node --test tests/router.test.mjs tests/static-ui.test.mjs`

Expected: the IELTS route assertions fail.

- [ ] **Step 3: Add the product route and entry**

Add `{ name: "ielts", pattern: /^#\/ielts\/?$/ }` to `ROUTES`, include `ielts` in the `scenes` global section, render `<IeltsView />` in `App.jsx`, and change only the IELTS professional-module button to navigate to `#/ielts`.

- [ ] **Step 4: Add namespaced responsive styles**

Append `.ielts-*` styles for home cards, preflight, exam layout, Cue Card, timers, transcript, report hero, four official cards, radar layout, task-achievement evidence, partial states, and mobile stacking. Do not alter unrelated product selectors unless browser verification proves a collision.

- [ ] **Step 5: Run frontend verification and commit**

```bash
cd frontend
npm test
npm run lint
npm run typecheck
npm run build
git add src/App.jsx src/router.mjs src/views/ScenesView.jsx styles.css tests
git commit -m "feat: integrate IELTS into UniSpeaking product navigation"
```

---

### Task 9: Add Safe Health Flags, Local Scripts, and Documentation

**Files:**
- Modify: `backend/src/main/java/com/example/unispeaking/controller/ScoringController.java`
- Modify: `backend/src/test/java/com/example/unispeaking/FreeChatRegressionTest.java`
- Create: `.env.example`
- Create: `scripts/start-local.sh`
- Create: `scripts/stop-local.sh`
- Create: `README.md`
- Test: `frontend/tests/local-project-contract.test.mjs`

**Interfaces:**
- `/health` returns booleans only: `java`, `qwenRealtimeConfigured`, `qwenScoringConfigured`, `xfyunConfigured`.
- Scripts write only `.run/frontend.pid`, `.run/backend.pid`, and matching logs.

- [ ] **Step 1: Write failing health and root-contract tests**

MockMvc assertions:

```java
jsonPath("$.java").value(true)
jsonPath("$.qwenRealtimeConfigured").isBoolean()
jsonPath("$.qwenScoringConfigured").isBoolean()
jsonPath("$.xfyunConfigured").isBoolean()
```

Node contract assertions check that `.env.example`, both scripts, and README exist; `.env.example` contains all eight documented variable names; and no file contains Supabase service-role or Vercel configuration.

- [ ] **Step 2: Run and verify RED**

Run:

```bash
cd backend && ./mvnw -Dtest=FreeChatRegressionTest test
cd ../frontend && node --test tests/local-project-contract.test.mjs
```

Expected: at least the new root-file and health-field assertions fail.

- [ ] **Step 3: Implement safe health capability flags**

Return only configuration booleans. Never return credential values, prefixes, lengths, workspace IDs, provider responses, or stack traces.

- [ ] **Step 4: Add the environment example**

Use only these assignments:

```dotenv
DASHSCOPE_API_KEY=
BAILIAN_WORKSPACE_ID=
BAILIAN_MODEL=qwen3.5-omni-plus-realtime
QWEN_SCORING_MODEL=qwen-plus
QWEN_IELTS_JUDGE_MODEL=qwen-plus
XFYUN_APPID=
XFYUN_APIKEY=
XFYUN_APISECRET=
```

- [ ] **Step 5: Implement safe start/stop scripts**

`start-local.sh` must:

- resolve its own parent directory;
- source `.env` if present with `set -a`/`set +a`;
- refuse to start if ports `8000` or `8080` are owned by unrelated processes;
- run `npm run dev -- --host 127.0.0.1 --port 8080` and `./mvnw spring-boot:run`;
- write exact child PIDs and logs under `.run/`;
- poll `/health` and the frontend root for at most 45 seconds;
- stop children if either service fails startup.

`stop-local.sh` must validate each PID is numeric and that its command line belongs to this project before sending `TERM`. It must never use `pkill`, port-wide kills, globs, or an unresolved environment variable as a target.

- [ ] **Step 6: Write the README**

Document Java 21, Node/npm, `.env` setup, one-command start/stop, URL `http://127.0.0.1:8080/#/ielts`, external provider requirements, memory-only data, test commands, report disclaimer, and source-directory preservation.

- [ ] **Step 7: Run tests, exercise scripts, and commit**

```bash
cd backend && ./mvnw test
cd ../frontend && npm test
cd ..
zsh -n scripts/start-local.sh scripts/stop-local.sh
./scripts/start-local.sh
curl -fsS http://127.0.0.1:8000/health
curl -fsS http://127.0.0.1:8080/#/ielts
./scripts/stop-local.sh
git add .env.example .gitignore README.md scripts backend/src frontend/tests
git commit -m "chore: add safe local runtime and documentation"
```

---

### Task 10: Full Verification, Browser Acceptance, and Final Cleanup

**Files:**
- Modify only files proven necessary by failing verification.
- Do not retain screenshots, `dist`, `target`, `.run`, logs, PIDs, or local `.env`.

**Interfaces:**
- Consumes: the complete local project.
- Produces: fresh evidence for every acceptance criterion in the approved design.

- [ ] **Step 1: Run all automated verification from a clean dependency state**

```bash
cd /Users/mac/Documents/七牛云/demo/UniSpeaking_Local_Final/frontend
npm ci
npm run lint
npm run typecheck
npm test
npm run build
cd ../backend
./mvnw test
```

Expected: every command exits `0`, with zero failed tests and no type/lint errors.

- [ ] **Step 2: Start the local stack and verify service contracts**

```bash
cd /Users/mac/Documents/七牛云/demo/UniSpeaking_Local_Final
./scripts/start-local.sh
curl -fsS http://127.0.0.1:8000/health
curl -fsS http://127.0.0.1:8080/
```

Expected: Java health is valid JSON with booleans only; frontend returns HTTP 200.

- [ ] **Step 3: Perform desktop browser acceptance**

At a desktop viewport, verify:

1. `#/scenes` opens IELTS at `#/ielts` without membership redirect.
2. Full mock and Part practice choices render.
3. Preflight reports backend/provider/microphone state accurately.
4. Accelerated Demo reaches Part 1, Part 2 Cue Card/preparation/long answer, and Part 3.
5. Finishing triggers one finalize call and report polling.
6. Complete report displays Overall, four official cards, and five radar axes.
7. Task Achievement is labeled non-official and does not change the four-band Overall.
8. Exiting releases the microphone indicator and closes network resources.

- [ ] **Step 4: Perform mobile browser acceptance**

At `390 × 844`, repeat navigation, preflight, Part 2 card, answer controls, and report checks. Verify every primary control has a usable touch target, no horizontal scrolling blocks content, and the radar labels remain readable.

- [ ] **Step 5: Verify free-chat regression through local Java**

Open `#/conversation`, create and close a local session, and confirm browser requests target the Vite origin `/api/*`, contain no Supabase `apikey`, and release the microphone on exit.

- [ ] **Step 6: Stop services and clean generated artifacts from the final directory**

Run `./scripts/stop-local.sh`, then use exact-path `apply_patch` deletions or package/build cleanup commands for generated project artifacts. Verify:

```bash
find . -type d \( -name node_modules -o -name dist -o -name target -o -name .vite -o -name .run -o -name .vercel -o -name supabase -o -name acceptance \) -print
find . -type f \( -name '.env' -o -name '*.log' -o -name '*.pid' -o -name '.DS_Store' \) -print
rg -n "SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY|VITE_SUPABASE|vercel\.json" . --glob '!docs/**'
```

Expected: all three commands print nothing after deliberate dependency/build cleanup. The lockfiles, Maven wrapper configuration, source, tests, docs, and `.env.example` remain.

- [ ] **Step 7: Review the final diff against the approved design**

Check each of the ten acceptance criteria in `docs/superpowers/specs/2026-07-22-local-unified-ielts-integration-design.md`. Inspect `git status --short` and `git diff --stat`; confirm the four source directories show no worktree modifications attributable to this implementation.

- [ ] **Step 8: Commit verification fixes and final cleanup**

```bash
git add demo/UniSpeaking_Local_Final
git commit -m "test: verify local unified IELTS experience"
```

Do not claim completion until the commands in Steps 1, 2, and 6 have been rerun after the last code change and their full outputs confirm success.
