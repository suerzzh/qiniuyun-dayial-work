import assert from "node:assert/strict";
import { access, chmod, copyFile, mkdir, mkdtemp, readFile, readdir, realpath, rm, stat, symlink, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { execFile, spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import test from "node:test";

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = resolve(frontendRoot, "..");

const projectPath = (...parts) => resolve(projectRoot, ...parts);
const frontendPath = (...parts) => resolve(frontendRoot, ...parts);
const execFileAsync = promisify(execFile);

async function assertExists(path) {
  await access(path, constants.F_OK);
}

async function run(path, env = {}, timeout = 25_000) {
  try {
    const result = await execFileAsync("/bin/zsh", [path], {
      env: { ...process.env, ...env },
      timeout,
    });
    return { code: 0, ...result };
  } catch (error) {
    return { code: error.code, stdout: error.stdout || "", stderr: error.stderr || "" };
  }
}

async function waitUntil(predicate, timeout = 2_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
  }
  throw new Error("condition not reached before timeout");
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function createScriptHarness() {
  const root = await realpath(await mkdtemp(join(tmpdir(), "unispeaking-local-scripts-")));
  const scripts = join(root, "scripts");
  const frontend = join(root, "frontend");
  const backend = join(root, "backend");
  const fakeBin = join(root, "fake-bin");
  const ledger = join(root, "processes.log");
  await Promise.all([mkdir(scripts), mkdir(frontend), mkdir(backend), mkdir(fakeBin)]);
  await Promise.all([
    copyFile(projectPath("scripts", "start-local.sh"), join(scripts, "start-local.sh")),
    copyFile(projectPath("scripts", "stop-local.sh"), join(scripts, "stop-local.sh")),
  ]);
  const service = `#!/bin/zsh
if [[ "\${FAKE_EXIT:-0}" == "1" && "$0" == *mvnw ]]; then exit 23; fi
sleep 300 &
child=$!
print -- "$$ $child" >> "$FAKE_LEDGER"
trap 'exit 0' TERM INT HUP
wait "$child"
`;
  const fakeLsof = `#!/bin/zsh
for argument in "$@"; do
  if [[ -n "\${FAKE_OCCUPIED_PORT:-}" && "$argument" == "-iTCP:\${FAKE_OCCUPIED_PORT}" ]]; then
    print -- 424242
    exit 0
  fi
done
exec /usr/sbin/lsof "$@"
`;
  await Promise.all([
    writeFile(join(fakeBin, "npm"), service),
    writeFile(join(backend, "mvnw"), service),
    writeFile(join(fakeBin, "curl"), "#!/bin/zsh\n[[ \"${FAKE_CURL_FAIL:-0}\" == 1 ]] && exit 22\nexit 0\n"),
    writeFile(join(fakeBin, "lsof"), fakeLsof),
  ]);
  const executables = [
    join(scripts, "start-local.sh"), join(scripts, "stop-local.sh"),
    join(fakeBin, "npm"), join(backend, "mvnw"), join(fakeBin, "curl"), join(fakeBin, "lsof"),
  ];
  await Promise.all(executables.map((path) => chmod(path, 0o755)));
  return {
    root,
    start: join(scripts, "start-local.sh"),
    stop: join(scripts, "stop-local.sh"),
    frontend,
    ledger,
    env: { PATH: `${fakeBin}:${process.env.PATH}`, FAKE_LEDGER: ledger },
  };
}

async function ledgerPids(path) {
  try {
    return (await readFile(path, "utf8")).trim().split(/\s+/).filter(Boolean).map(Number);
  } catch {
    return [];
  }
}

async function terminateTestPids(pids) {
  for (const pid of [...new Set(pids)]) {
    if (!Number.isInteger(pid) || !isAlive(pid)) continue;
    try { process.kill(-pid, "SIGKILL"); } catch { try { process.kill(pid, "SIGKILL"); } catch {} }
  }
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
  assert.match(startSource, /EPOCHREALTIME/);
  assert.match(startSource, /detached:\s*true/);
  assert.match(startSource, /\.unref\(\)/);
  assert.match(startSource, /fsyncSync/);
  assert.match(startSource, /process\.kill\(-pid/);
  for (const target of ["frontend.pid", "backend.pid", "frontend.log", "backend.log"]) {
    assert.match(startSource, new RegExp(`\\.run[/\"'}$A-Za-z_{-]*${target.replace(".", "\\.")}`));
  }

  assert.match(stopSource, /\[!0-9\]/);
  assert.match(stopSource, /ps -p/);
  assert.match(stopSource, /lsof/);
  assert.match(stopSource, /LC_ALL=(?:en_US|zh_CN)\.UTF-8 lsof/);
  assert.match(stopSource, /classworlds\.launcher\.Launcher/);
  assert.match(stopSource, /PGID|pgid/);
  assert.match(stopSource, /kill -TERM[^\n]*-\$pid/);
  assert.doesNotMatch(stopSource, /^status=/m);
  assert.doesNotMatch(stopSource, /\b(?:pkill|killall)\b/);
  assert.doesNotMatch(stopSource, /kill -TERM[^\n]*\*/);
});

test("start refuses an occupied service port without launching children", { concurrency: false }, async (t) => {
  const harness = await createScriptHarness();
  t.after(async () => rm(harness.root, { recursive: true, force: true }));
  const result = await run(harness.start, { ...harness.env, FAKE_OCCUPIED_PORT: "8000" });
  assert.notEqual(result.code, 0);
  assert.deepEqual(await ledgerPids(harness.ledger), []);
  await assert.rejects(access(join(harness.root, ".run", "frontend.pid")), { code: "ENOENT" });
});

test("failed PID publication never follows a symlink or leaves its detached group", { concurrency: false }, async (t) => {
  const harness = await createScriptHarness();
  const runDir = join(harness.root, ".run");
  const sentinel = join(harness.root, "sentinel");
  await mkdir(runDir);
  await writeFile(sentinel, "sentinel");
  await symlink(sentinel, join(runDir, "frontend.pid"));
  t.after(async () => {
    await terminateTestPids(await ledgerPids(harness.ledger));
    await rm(harness.root, { recursive: true, force: true });
  });

  const result = await run(harness.start, harness.env);
  const pids = await ledgerPids(harness.ledger);
  assert.notEqual(result.code, 0);
  assert.equal(await readFile(sentinel, "utf8"), "sentinel");
  await waitUntil(() => pids.every((pid) => !isAlive(pid)));
  assert.deepEqual((await readdir(runDir)).filter((name) => name.endsWith(".tmp")), []);
});

test("stop removes dead PIDs but refuses invalid or non-leader reused PIDs", { concurrency: false }, async (t) => {
  const harness = await createScriptHarness();
  const runDir = join(harness.root, ".run");
  const pidFile = join(runDir, "frontend.pid");
  await mkdir(runDir);
  t.after(async () => {
    await terminateTestPids(await ledgerPids(harness.ledger));
    await rm(harness.root, { recursive: true, force: true });
  });

  await writeFile(pidFile, "not-a-pid\n");
  assert.notEqual((await run(harness.stop, harness.env)).code, 0);
  assert.equal(await readFile(pidFile, "utf8"), "not-a-pid\n");

  await writeFile(pidFile, "999999\n");
  assert.equal((await run(harness.stop, harness.env)).code, 0);
  await assert.rejects(access(pidFile), { code: "ENOENT" });

  const child = spawn(join(harness.root, "fake-bin", "npm"), ["run", "dev", "--", "--host", "127.0.0.1", "--port", "8080"], {
    cwd: harness.frontend,
    env: { ...process.env, ...harness.env },
    stdio: "ignore",
  });
  await waitUntil(() => isAlive(child.pid));
  await writeFile(pidFile, `${child.pid}\n`);
  assert.notEqual((await run(harness.stop, harness.env)).code, 0);
  assert.equal(isAlive(child.pid), true);
});

test("stop terminates the validated process groups including descendants", { concurrency: false }, async (t) => {
  const harness = await createScriptHarness();
  t.after(async () => {
    await terminateTestPids(await ledgerPids(harness.ledger));
    await rm(harness.root, { recursive: true, force: true });
  });
  const startResult = await run(harness.start, harness.env);
  assert.equal(startResult.code, 0, `${startResult.stdout}\n${startResult.stderr}`);
  await waitUntil(async () => (await ledgerPids(harness.ledger)).length >= 4);
  const pids = await ledgerPids(harness.ledger);
  const leaders = await Promise.all(["frontend", "backend"].map(async (service) => {
    const pid = Number((await readFile(join(harness.root, ".run", `${service}.pid`), "utf8")).trim());
    const observed = await execFileAsync("ps", ["-p", String(pid), "-o", "pid=,pgid=,command="]);
    return observed.stdout.trim();
  }));
  const stopResult = await run(harness.stop, harness.env, 15_000);
  assert.equal(stopResult.code, 0, `${leaders.join("\n")}\n${stopResult.stderr}`);
  await waitUntil(() => pids.every((pid) => !isAlive(pid)));
  await assert.rejects(access(join(harness.root, ".run", "frontend.pid")), { code: "ENOENT" });
  await assert.rejects(access(join(harness.root, ".run", "backend.pid")), { code: "ENOENT" });
});

test("startup failure removes every started group and PID file", { concurrency: false }, async (t) => {
  const harness = await createScriptHarness();
  t.after(async () => {
    await terminateTestPids(await ledgerPids(harness.ledger));
    await rm(harness.root, { recursive: true, force: true });
  });
  const result = await run(harness.start, { ...harness.env, FAKE_EXIT: "1", FAKE_CURL_FAIL: "1" }, 15_000);
  const pids = await ledgerPids(harness.ledger);
  assert.notEqual(result.code, 0);
  await waitUntil(() => pids.every((pid) => !isAlive(pid)));
  const remaining = await readdir(join(harness.root, ".run"));
  assert.deepEqual(remaining.filter((name) => name.endsWith(".pid") || name.endsWith(".tmp")), []);
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
