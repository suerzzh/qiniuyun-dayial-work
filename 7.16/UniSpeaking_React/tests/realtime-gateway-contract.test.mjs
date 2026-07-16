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
const gatewayConfigPath = resolve(testDirectory, "../../supabase/config.toml");
const gatewayPromptPath = resolve(gatewayDirectory, "clara_current_en.txt");
const gatewayRestaurantPromptPath = resolve(
  gatewayDirectory,
  "clara_restaurant_child_en.txt"
);
const reviewedPromptPath = resolve(
  testDirectory,
  "../../UniSpeaking/backend/clara_current_en.txt"
);
const restaurantPromptDocumentPath = resolve(
  testDirectory,
  "../../Clara_评委特供版_儿童餐厅点餐提示词中英对照.md"
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

test("the production gateway allows every public UniSpeaking origin", () => {
  const source = readFileSync(gatewaySourcePath, "utf8");
  for (const origin of [
    "https://app.unispeaking.cn",
    "https://www.unispeaking.cn",
    "https://unispeaking.cn",
  ]) {
    assert.equal(
      source.includes(JSON.stringify(origin)),
      true,
      `${origin} must be included in the production CORS allowlist`
    );
  }
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

test("the production gateway selects the exact child restaurant prompt", () => {
  assert.equal(
    existsSync(gatewayRestaurantPromptPath),
    true,
    "restaurant prompt asset must exist"
  );
  const document = readFileSync(restaurantPromptDocumentPath, "utf8");
  const promptMatch = document.match(
    /## 3\. 完整英文系统提示词[\s\S]*?```text\n([\s\S]*?)\n```/
  );
  assert.ok(promptMatch, "reviewed restaurant prompt block must exist");
  const reviewedPrompt = promptMatch[1].trim();
  assert.equal(readFileSync(gatewayRestaurantPromptPath, "utf8").trim(), reviewedPrompt);

  const source = readFileSync(gatewaySourcePath, "utf8");
  assert.match(source, /clara_restaurant_child_en\.txt/);
  assert.match(source, /child-restaurant-ordering/);
  assert.match(source, /scenario_id/);
  assert.match(
    source,
    /if \(prompt && scenarioId !== CHILD_RESTAURANT_SCENARIO_ID\)/,
    "restaurant instructions must ignore client-provided lesson prompts"
  );
  const config = readFileSync(gatewayConfigPath, "utf8");
  assert.match(config, /static_files\s*=\s*\[[^\]]*clara_restaurant_child_en\.txt/);
});
