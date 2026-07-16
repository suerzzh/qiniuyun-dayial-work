import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFile(join(root, path), "utf8");

test("application shell exposes semantic global navigation", async () => {
  const html = await read("index.html");
  const app = await read("src/App.jsx");
  assert.match(html, /<div id="root"><\/div>/);
  assert.match(html, /src="\/src\/main\.jsx"/);
  assert.match(app, /<nav[^>]+aria-label="全局导航"/);
  assert.match(app, /href="#\/conversation"/);
  assert.match(app, /href="#\/scenes"/);
  assert.match(app, /href="#\/review"/);
  assert.match(app, /href="#\/profile\/overview"/);
  assert.match(app, /<main[^>]+id="app-root"/);
});

test("source contains all routes and excludes banned product patterns", async () => {
  const files = [
    "index.html",
    "src/router.mjs",
    "src/App.jsx",
    "src/views/ConversationView.jsx",
    "src/views/ScenesView.jsx",
    "src/views/TrainingView.jsx",
    "src/views/ReviewView.jsx",
    "src/views/ProfileView.jsx",
  ];
  const source = (await Promise.all(files.map(read))).join("\n");
  for (const route of [
    "#/conversation", "#/scenes", "#/review", "#/review/cafe",
    "#/training/cafe/words", "#/training/cafe/sentences",
    "#/training/cafe/simulation",
    "#/profile/overview", "#/profile/settings",
  ]) assert.match(source, new RegExp(route.replaceAll("/", "\\/")));

  for (const banned of ["排名", "连续打卡", "勋章", "爱心", "重新模拟", "整场复练"])
    assert.equal(source.includes(banned), false, `unexpected banned copy: ${banned}`);
});

test("simulation ends with an in-context radar score modal", async () => {
  const training = await read("src/views/TrainingView.jsx");
  assert.match(training, /score-modal/);
  assert.match(training, /radar-chart/);
  assert.match(training, /返回场景广场/);
  assert.match(training, /查看学习资产/);
});

test("training controls follow the simplified three-stage interaction", async () => {
  const training = await read("src/views/TrainingView.jsx");
  assert.match(training, /word-audio-btn/);
  assert.equal(training.includes("听原声示范"), false);
  assert.equal(training.includes("跟读这个表达"), false);
  assert.match(training, /上一个/);
  assert.match(training, /sentence-record is-centered/);
  assert.match(training, /simulation-voice is-centered/);
  assert.match(training, /结束模拟/);
  assert.equal(training.includes("simulation-brief"), false);
  assert.match(training, /选择饮品和杯型/);
  assert.match(training, /sentence-list training-sidebar/);
  assert.match(training, /asset-queue training-sidebar/);
});

test("stylesheet contains the approved quality floor", async () => {
  const css = await read("styles.css");
  for (const token of ["--bg:#faf9f5", "--ink:#20211e", "--accent:#e8462d", "--blue:#1e7fbf"])
    assert.equal(css.toLowerCase().replaceAll(" ", "").includes(token), true, `missing ${token}`);
  assert.match(css, /:focus-visible/);
  assert.match(css, /height:\s*100dvh/);
  assert.match(css, /font-variant-numeric:\s*tabular-nums/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /@media\s*\(max-width:\s*760px\)/);
  assert.match(css, /min-height:\s*44px/);
});

test("desktop directory pages reserve enough space to avoid internal page drift", async () => {
  const css = await read("styles.css");
  assert.match(css, /\.scene-layout\{height:calc\(100% - 107px\)/);
  assert.match(css, /\.review-overview\{height:calc\(100% - 107px\)/);
  assert.match(css, /\.review-detail-layout\{height:calc\(100% - 275px\)/);
});

test("settings ranges use native keyboard-accessible inputs", async () => {
  const profile = await read("src/views/ProfileView.jsx");
  assert.match(profile, /type="range"/);
});

test("brand cell is opaque so mobile sticky-header capture stays stable", async () => {
  const css = await read("styles.css");
  assert.match(css, /\.brand\{[^}]*background:var\(--nav\)/);
});

test("mobile controls use 44px hit areas without enlarging switch tracks", async () => {
  const css = await read("styles.css");
  assert.match(css, /--tap:44px/);
  assert.match(css, /\.history-table \.icon-action\{width:var\(--tap\);height:var\(--tap\);min-height:var\(--tap\)/);
  assert.match(css, /\.switch\{width:48px;height:var\(--tap\);min-height:var\(--tap\);background:transparent\}/);
  assert.match(css, /\.switch:before\{/);
});
