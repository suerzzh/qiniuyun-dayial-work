import test from "node:test";
import assert from "node:assert/strict";

import { createInitialState } from "../src/state.mjs";
import { renderTraining } from "../src/views/training.mjs";

const state = createInitialState();

test("renders every approved training stage", () => {
  const expectations = {
    words: ["场景词语", "recommend", "进入句子训练"],
    sentences: ["整句跟读", "Could you recommend", "进入情景模拟"],
    simulation: ["情景模拟", "咖啡店店员", "完成并查看诊断"],
    diagnostic: ["训练诊断", "综合表现", "发音清晰度"],
  };

  for (const [stage, copies] of Object.entries(expectations)) {
    const html = renderTraining(stage, state);
    assert.match(html, /class="training-page/);
    assert.match(html, /aria-label="训练进度"/);
    for (const copy of copies) assert.equal(html.includes(copy), true, `${stage} is missing ${copy}`);
  }
});

test("unknown stage falls back to words instead of rendering an empty page", () => {
  assert.equal(renderTraining("unknown", state).includes("场景词语"), true);
});
