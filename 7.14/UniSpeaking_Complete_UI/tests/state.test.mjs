import test from "node:test";
import assert from "node:assert/strict";

import { createStore } from "../src/state.mjs";

test("store publishes state changes to subscribers", () => {
  const store = createStore({ muted: false });
  const states = [];
  const unsubscribe = store.subscribe((state) => states.push(state));
  store.setState({ muted: true });
  unsubscribe();
  store.setState({ muted: false });

  assert.equal(states.length, 1);
  assert.equal(states[0].muted, true);
});

test("resetConversation returns voice UI to a clean ready state", () => {
  const store = createStore({
    voiceState: "speaking",
    activeConversation: "movie",
    transcriptDraft: "unfinished",
  });
  store.resetConversation();
  assert.deepEqual(store.getState(), {
    voiceState: "ready",
    activeConversation: "new",
    transcriptDraft: "",
  });
});
