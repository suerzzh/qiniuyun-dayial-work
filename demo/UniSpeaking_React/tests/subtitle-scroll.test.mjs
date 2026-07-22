import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("subtitle follow stays active near the bottom and pauses after manual upward scrolling", async () => {
  let module;
  try {
    module = await import("../src/realtime/subtitle-scroll.mjs");
  } catch {
    module = null;
  }

  assert.equal(typeof module?.isNearScrollBottom, "function");
  assert.equal(
    module.isNearScrollBottom({ scrollHeight: 1000, scrollTop: 552, clientHeight: 400 }),
    true,
  );
  assert.equal(
    module.isNearScrollBottom({ scrollHeight: 1000, scrollTop: 500, clientHeight: 400 }),
    false,
  );
});

test("the conversation subtitle container follows message progress without forcing manual readers", async () => {
  const source = await readFile(
    new URL("../src/views/ConversationView.jsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /subtitleContainerRef/);
  assert.match(source, /shouldFollowSubtitlesRef/);
  assert.match(source, /session\.messages\.map/);
  assert.match(source, /scrollTo\(\{[\s\S]*behavior:\s*"smooth"/);
  assert.match(source, /onScroll=\{handleSubtitleScroll\}/);
  assert.match(source, /onWheel=\{handleManualScrollIntent\}/);
});
