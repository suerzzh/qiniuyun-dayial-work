import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFile(join(root, path), "utf8");

test("application shell exposes semantic global navigation", async () => {
  const html = await read("index.html");
  assert.match(html, /href="\.\/styles\.css\?v=20260713-2"/);
  assert.match(html, /rel="icon"[^>]+href="data:image\/svg\+xml/);
  assert.match(html, /<nav[^>]+aria-label="全局导航"/);
  assert.match(html, /href="#\/conversation"/);
  assert.match(html, /href="#\/scenes"/);
  assert.match(html, /href="#\/review"/);
  assert.match(html, /href="#\/profile\/overview"/);
  assert.match(html, /<main[^>]+id="app-root"/);
});

test("source contains all routes and excludes banned product patterns", async () => {
  const files = [
    "index.html",
    "src/app.mjs",
    "src/views/conversation.mjs",
    "src/views/scenes.mjs",
    "src/views/training.mjs",
    "src/views/review.mjs",
    "src/views/profile.mjs",
  ];
  const source = (await Promise.all(files.map(read))).join("\n");
  for (const route of [
    "#/conversation", "#/scenes", "#/review", "#/review/cafe",
    "#/training/cafe/words", "#/training/cafe/sentences",
    "#/training/cafe/simulation", "#/training/cafe/diagnostic",
    "#/profile/overview", "#/profile/assets", "#/profile/scenes", "#/profile/settings",
  ]) assert.match(source, new RegExp(route.replaceAll("/", "\\/")));

  for (const banned of ["排名", "连续打卡", "勋章", "爱心", "重新模拟", "整场复练"])
    assert.equal(source.includes(banned), false, `unexpected banned copy: ${banned}`);
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

test("settings ranges provide explicit keyboard controls", async () => {
  const app = await read("src/app.mjs");
  assert.match(app, /addEventListener\("keydown"/);
  for (const key of ["ArrowLeft", "ArrowDown", "ArrowRight", "ArrowUp", "Home", "End"])
    assert.equal(app.includes(`"${key}"`), true, `missing keyboard key: ${key}`);
  assert.match(app, /event\.preventDefault\(\)/);
});

test("application imports every data collection it reads", async () => {
  const app = await read("src/app.mjs");
  assert.match(app, /import \{[^}]*learningAssets[^}]*\} from "\.\/data\.mjs"/s);
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

test("IELTS demo keeps the cue card first and exposes responsive controls", async () => {
  const [view, css] = await Promise.all([read("src/views/ielts.mjs"), read("styles.css")]);
  assert.match(view, /ielts-cue-card/);
  assert.match(view, /DEMO 加速模式/);
  assert.match(css, /\.ielts-cue-card\{/);
  assert.match(css, /\.ielts-mode-card:focus-visible/);
  assert.match(css, /\.ielts-session-tools button\{[^}]*min-height:44px/);
  assert.match(css, /@media\s*\(max-width:\s*760px\)[\s\S]*\.ielts-preflight-grid/);
});

test("README documents the local IELTS Demo boundary", async () => {
  const readme = await read("README.md");
  assert.match(readme, /## IELTS Speaking Demo/);
  assert.match(readme, /http:\/\/localhost:8080\/#\/ielts/);
  assert.match(readme, /speech synthesis/i);
  assert.match(readme, /does not call the production Realtime provider/i);
  assert.match(readme, /Web Speech API/i);
  assert.match(readme, /microphone permission is requested only after/i);
  assert.match(readme, /raw audio is not uploaded or saved/i);
});

test("stale Part 2 note events are ignored after preparation expires", async () => {
  const app = await read("src/app.mjs");
  assert.match(
    app,
    /if \(ieltsController\.getSnapshot\(\)\.exam\?\.status === "part2_preparing"\)\s*\{\s*ieltsController\.updateNotes\(input\.value\)/,
  );
});

test("IELTS microphone actions are wired through an isolated voice controller", async () => {
  const app = await read("src/app.mjs");
  assert.match(app, /import \{ createSpeechRecognitionAdapter \}/);
  assert.match(app, /import \{ createVoiceAnswerController \}/);
  assert.match(app, /renderIelts\(ieltsController\.getSnapshot\(\), voiceAnswerController\.getSnapshot\(\)\)/);
  for (const action of ["ielts-voice-start", "ielts-voice-pause", "ielts-voice-resume", "ielts-voice-finish"]) {
    assert.match(app, new RegExp(`action === "${action}"`));
  }
  assert.match(app, /const transcript = voiceAnswerController\.finish\(\);\s*ieltsController\.submitAnswer\(transcript\);\s*voiceAnswerController\.reset\(\)/s);
  assert.match(app, /input\.matches\("\[data-action='ielts-voice-transcript'\]"\)/);
  assert.match(app, /voiceAnswerController\.updateTranscript\(input\.value\)/);
  assert.match(app, /beforeunload[\s\S]*voiceAnswerController\.dispose\(\)/);
});

test("IELTS microphone panel has responsive and reduced-motion visual contracts", async () => {
  const [view, css] = await Promise.all([read("src/views/ielts.mjs"), read("styles.css")]);
  assert.doesNotMatch(view, /DEMO ANSWER TRANSCRIPT/);
  for (const selector of [".ielts-voice-panel", ".ielts-mic-button", ".ielts-waveform", ".ielts-transcript"]) {
    assert.equal(css.includes(selector), true, `missing ${selector}`);
  }
  assert.match(css, /\.ielts-mic-button\{[^}]*width:72px[^}]*height:72px/);
  assert.match(css, /\.ielts-voice-panel\.is-listening[\s\S]*\.ielts-waveform i/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:reduce\)[\s\S]*\.ielts-waveform/);
  assert.match(css, /@media\s*\(max-width:760px\)[\s\S]*\.ielts-mic-button\{[^}]*width:80px[^}]*height:80px/);
});
