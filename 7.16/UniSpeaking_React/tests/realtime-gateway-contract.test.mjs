import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const gatewayDirectory = resolve(
  testDirectory,
  "../../supabase/functions/realtime-gateway"
);
const gatewaySourcePath = resolve(gatewayDirectory, "index.ts");
const gatewayPromptPath = resolve(gatewayDirectory, "clara_current_en.txt");
const reviewedPromptPath = resolve(
  testDirectory,
  "../../UniSpeaking/backend/clara_current_en.txt"
);

test("the production gateway implements the current frontend and legacy routes", () => {
  assert.equal(existsSync(gatewaySourcePath), true, "gateway source must exist");
  const source = readFileSync(gatewaySourcePath, "utf8");
  for (const routeMarker of [
    '"/health"',
    '"/api/sessions"',
    '"/api/realtime"',
    '"/events"',
    '"/provider-session"',
    '"/tools/learner-level"',
    '"/quality"',
    '"/session"',
    '"/sdp"',
  ]) {
    assert.match(source, new RegExp(routeMarker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(source, /ACCEPTED_PUBLIC_KEYS/);
  assert.match(source, /ALLOWED_WEB_ORIGINS/);
  assert.match(source, /DASHSCOPE_API_KEY/);
  assert.doesNotMatch(source, /VITE_DASHSCOPE|service_role\s*[:=]\s*["'][^"']+["']/i);
});

test("the production gateway deploys the exact reviewed Clara prompt", () => {
  assert.equal(existsSync(gatewayPromptPath), true, "gateway prompt asset must exist");
  const reviewedPrompt = readFileSync(reviewedPromptPath, "utf8");
  assert.equal(
    readFileSync(gatewayPromptPath, "utf8"),
    reviewedPrompt
  );
  const source = readFileSync(gatewaySourcePath, "utf8");
  assert.equal(source.includes(JSON.stringify(reviewedPrompt.trim())), true);
  assert.doesNotMatch(source, /Deno\.readTextFile/);
});
