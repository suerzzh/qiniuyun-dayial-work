import test from "node:test";
import assert from "node:assert/strict";

import { REVIEWABLE_KINDS, isReviewable } from "../src/data.mjs";

test("review is limited to learned language assets", () => {
  assert.deepEqual(REVIEWABLE_KINDS, ["word", "phrase", "sentence"]);
  for (const kind of REVIEWABLE_KINDS) assert.equal(isReviewable(kind), true);
  assert.equal(isReviewable("simulation"), false);
  assert.equal(isReviewable("scene"), false);
});
