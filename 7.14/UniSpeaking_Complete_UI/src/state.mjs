export function createStore(initialState = {}) {
  let state = { ...initialState };
  const listeners = new Set();
  return {
    getState: () => ({ ...state }),
    setState(patch) {
      state = { ...state, ...(typeof patch === "function" ? patch(state) : patch) };
      for (const listener of listeners) listener({ ...state });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    resetConversation() {
      state = { ...state, voiceState: "ready", activeConversation: "new", transcriptDraft: "" };
      for (const listener of listeners) listener({ ...state });
    },
  };
}

export function createInitialState(saved = {}) {
  return {
    activeConversation: "new",
    voiceState: "ready",
    transcriptDraft: "",
    textOpen: false,
    muted: false,
    activeAsset: 0,
    reviewFilter: "all",
    playingId: "",
    recording: false,
    settings: { speed: 140, difficulty: 3, listenFirst: true, proactive: true },
    theme: "polar",
    saveStatus: "clean",
    mobileNavOpen: false,
    user: { name: "Yufan", email: "yufan@example.com" },
    membership: "free",
    hasCheckedIn: false,
    masteryStatus: {},
    customSceneConfig: { prompt: "", difficulty: 3, duration: 5, requirements: "" },
    paymentModalOpen: false,
    realtime: { status: "idle", sessionId: null, messages: [], error: null, muted: false, startedAt: null },
    ...saved,
  };
}
