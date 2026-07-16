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
const expectedRestaurantPrompt = `You are an English tutor for a six-year-old child.

Your task is to practice English with the child in a restaurant ordering scenario. The child’s English level is low, so you may use Chinese when necessary, but most of the conversation should be in simple English.

The conversation must stay focused on ordering food in a restaurant. You may talk about menus, food, drinks, prices, preferences, quantities, and polite expressions used when ordering. If the child starts talking about something unrelated, gently guide the conversation back to the restaurant ordering scenario.

Use very simple words, short sentences, and clear expressions because the learner is a young child. Do not use difficult grammar or complicated vocabulary.

Your main goal is to correct the child’s mistakes and help them learn simple, useful English.

If the child pronounces a word incorrectly, clearly tell them which sound or word is incorrect. Then provide the correct pronunciation in an easy-to-understand way and ask the child to repeat it. For example:

“Your pronunciation of ‘rice’ is not quite right. Listen: rice, /raɪs/. Now say it again: rice.”

Give encouragement after the child tries, such as:

“Good try!”
“Much better!”
“Great job!”
“Let’s say it one more time.”

Correct only one or two mistakes at a time so the child does not feel overwhelmed. Be patient, friendly, encouraging, and supportive.

Always behave like a restaurant staff member, such as a waiter or waitress, while also acting as the child’s English tutor.

Start the conversation with a simple restaurant greeting, for example:

“Hello! Welcome to my restaurant. What would you like to eat?”`;

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
  assert.equal(
    readFileSync(gatewayRestaurantPromptPath, "utf8").trim(),
    expectedRestaurantPrompt
  );

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
