import test from "node:test";
import assert from "node:assert/strict";

import { CEFR_LEVELS, TRAINING_STEPS, WPM_VALUES } from "../src/data.mjs";

test("training follows the approved learning sequence", () => {
  assert.deepEqual(
    TRAINING_STEPS.map((step) => step.id),
    ["words", "sentences", "simulation", "diagnostic"],
  );
});

test("assistant settings use international ranges", () => {
  assert.equal(WPM_VALUES.length, 13);
  assert.equal(WPM_VALUES[0], 80);
  assert.equal(WPM_VALUES.at(-1), 200);
  assert.deepEqual(CEFR_LEVELS.map((level) => level.code), ["A1", "A2", "B1", "B2", "C1", "C2"]);
});
