import assert from "node:assert/strict";
import { access, readFile, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = resolve(frontendRoot, "..");

const projectPath = (...parts) => resolve(projectRoot, ...parts);
const frontendPath = (...parts) => resolve(frontendRoot, ...parts);

async function assertExists(path) {
  await access(path, constants.F_OK);
}

test("local project provides the documented environment and runtime files", async () => {
  await Promise.all([
    assertExists(projectPath(".env.example")),
    assertExists(projectPath("scripts", "start-local.sh")),
    assertExists(projectPath("scripts", "stop-local.sh")),
    assertExists(projectPath("README.md")),
  ]);
});

test("environment example contains only the eight supported assignments", async () => {
  const source = await readFile(projectPath(".env.example"), "utf8");
  assert.deepEqual(source.trimEnd().split("\n"), [
    "DASHSCOPE_API_KEY=",
    "BAILIAN_WORKSPACE_ID=",
    "BAILIAN_MODEL=qwen3.5-omni-plus-realtime",
    "QWEN_SCORING_MODEL=qwen-plus",
    "QWEN_IELTS_JUDGE_MODEL=qwen-plus",
    "XFYUN_APPID=",
    "XFYUN_APIKEY=",
    "XFYUN_APISECRET=",
  ]);
});

test("frontend declares the supported Node runtime in package metadata", async () => {
  const expected = "^20.19.0 || ^22.13.0 || >=24.0.0";
  const packageJson = JSON.parse(await readFile(frontendPath("package.json"), "utf8"));
  const packageLock = JSON.parse(await readFile(frontendPath("package-lock.json"), "utf8"));

  assert.equal(packageJson.engines?.node, expected);
  assert.equal(packageLock.packages?.[""]?.engines?.node, expected);
});

test("obsolete deployment README is removed", async () => {
  await assert.rejects(access(frontendPath("README.md"), constants.F_OK), { code: "ENOENT" });
});

test("local scripts expose only project-owned PID and log targets", async () => {
  const startPath = projectPath("scripts", "start-local.sh");
  const stopPath = projectPath("scripts", "stop-local.sh");
  const [startSource, stopSource, startStat, stopStat] = await Promise.all([
    readFile(startPath, "utf8"),
    readFile(stopPath, "utf8"),
    stat(startPath),
    stat(stopPath),
  ]);

  assert.notEqual(startStat.mode & 0o111, 0);
  assert.notEqual(stopStat.mode & 0o111, 0);
  assert.match(startSource, /set -a[\s\S]*source [^\n]*\.env[\s\S]*set \+a/);
  assert.match(startSource, /npm run dev -- --host 127\.0\.0\.1 --port 8080/);
  assert.match(startSource, /\.\/mvnw spring-boot:run/);
  assert.match(startSource, /127\.0\.0\.1:8000\/health/);
  assert.match(startSource, /127\.0\.0\.1:8080\//);
  assert.match(startSource, /45/);
  assert.match(startSource, /detached:\s*true/);
  assert.match(startSource, /\.unref\(\)/);
  for (const target of ["frontend.pid", "backend.pid", "frontend.log", "backend.log"]) {
    assert.match(startSource, new RegExp(`\\.run[/\"'}$A-Za-z_{-]*${target.replace(".", "\\.")}`));
  }

  assert.match(stopSource, /\[!0-9\]/);
  assert.match(stopSource, /ps -p/);
  assert.match(stopSource, /lsof/);
  assert.match(stopSource, /LC_ALL=(?:en_US|zh_CN)\.UTF-8 lsof/);
  assert.match(stopSource, /classworlds\.launcher\.Launcher/);
  assert.match(stopSource, /kill -TERM/);
  assert.doesNotMatch(stopSource, /^status=/m);
  assert.doesNotMatch(stopSource, /\b(?:pkill|killall)\b/);
  assert.doesNotMatch(stopSource, /kill -TERM[^\n]*\*/);
});

test("realtime API exposes only local origin and fetch options", async () => {
  const source = await readFile(frontendPath("src", "services", "realtime-api.mjs"), "utf8");
  assert.match(source, /createRealtimeApi\(\{ origin, fetchImpl = fetch \} = \{\}\)/);
  assert.doesNotMatch(source, /baseUrl|publicKey/);
});

test("root README documents the complete local-only workflow", async () => {
  const source = await readFile(projectPath("README.md"), "utf8");
  for (const required of [
    "Java 21",
    "Vite 8",
    "^20.19.0 || ^22.13.0 || >=24.0.0",
    "npm",
    ".env",
    "./scripts/start-local.sh",
    "./scripts/stop-local.sh",
    "http://127.0.0.1:8080/#/ielts",
    "DASHSCOPE_API_KEY",
    "XFYUN_APPID",
    "内存",
    "./mvnw test",
    "npm test",
    "非官方",
    "源目录",
  ]) {
    assert.ok(source.includes(required), `README must document ${required}`);
  }
});

test("active runtime and documentation contain no old deployment configuration", async () => {
  const activeFiles = [
    projectPath(".env.example"),
    projectPath("README.md"),
    projectPath("scripts", "start-local.sh"),
    projectPath("scripts", "stop-local.sh"),
    frontendPath("src", "services", "realtime-api.mjs"),
  ];
  const forbidden = /SUPABASE_(?:SERVICE_ROLE|SECRET)_KEY|VITE_SUPABASE|\.vercel\/|vercel\s+(?:pull|deploy)/i;

  for (const path of activeFiles) {
    const source = await readFile(path, "utf8");
    assert.doesNotMatch(source, forbidden, path);
  }
});
