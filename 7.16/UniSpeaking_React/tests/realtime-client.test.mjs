import test from "node:test";
import assert from "node:assert/strict";

import { createRealtimeClient } from "../src/realtime/realtime-client.mjs";

const flush = () => new Promise((resolve) => setImmediate(resolve));

function createHarness() {
  const events = [];
  const apiCalls = {
    create: 0,
    createOptions: [],
    exchange: [],
    remember: [],
    bind: [],
    update: [],
    quality: [],
    close: [],
  };
  const api = {
    async createSession(options) {
      apiCalls.create += 1;
      apiCalls.createOptions.push(options);
      return {
        session_id: `session-${apiCalls.create}`,
        conversation_id: options.conversation_id || "conversation-1",
        session_config: { voice: "Tina", modalities: ["text", "audio"] },
        history: [],
      };
    },
    async exchangeSdp(sessionId, offer) {
      apiCalls.exchange.push({ sessionId, offer });
      return "v=0\r\nanswer";
    },
    async rememberEvent(sessionId, event) { apiCalls.remember.push({ sessionId, event }); },
    async bindProviderSession(sessionId, providerSessionId) { apiCalls.bind.push({ sessionId, providerSessionId }); },
    async updateLearnerLevel(sessionId, args) { apiCalls.update.push({ sessionId, args }); return { applied: true, learner_profile: { label: "CET-4" } }; },
    async recordQuality(sessionId, metric) { apiCalls.quality.push({ sessionId, metric }); },
    async closeSession(sessionId) { apiCalls.close.push(sessionId); },
  };

  const track = { enabled: true, kind: "audio" };
  const stream = { getAudioTracks: () => [track], getTracks: () => [track] };
  const microphoneCalls = { request: 0, muted: [], paused: [], stop: 0 };
  const microphone = {
    async request() { microphoneCalls.request += 1; return stream; },
    getStream: () => stream,
    getAudioTracks: () => [track],
    setMuted(value) { microphoneCalls.muted.push(value); track.enabled = !value; return value; },
    setPaused(value) { microphoneCalls.paused.push(value); track.enabled = !value; return value; },
    isMuted: () => microphoneCalls.muted.at(-1) || false,
    isPaused: () => microphoneCalls.paused.at(-1) || false,
    stop() { microphoneCalls.stop += 1; track.enabled = false; },
  };
  const audioCalls = { attach: [], paused: [], stop: 0 };
  const audioPlayback = {
    async attach(remoteStream) { audioCalls.attach.push(remoteStream); },
    async setPaused(value) { audioCalls.paused.push(value); },
    async stop() { audioCalls.stop += 1; },
    isAudible: () => false,
  };

  const peers = [];
  const channels = [];
  const senders = [];
  function createPeerConnection() {
    const sent = [];
    const channel = {
      readyState: "open",
      closeCalls: 0,
      onmessage: null,
      onopen: null,
      onerror: null,
      send(raw) { sent.push(JSON.parse(raw)); },
      close() { this.closeCalls += 1; this.readyState = "closed"; },
    };
    const sender = {
      track,
      replacements: [],
      async replaceTrack(nextTrack) { this.replacements.push(nextTrack); this.track = nextTrack; },
    };
    const peer = {
      connectionState: "new",
      iceGatheringState: "complete",
      localDescription: null,
      closeCalls: 0,
      onconnectionstatechange: null,
      onicegatheringstatechange: null,
      ontrack: null,
      ondatachannel: null,
      addTrack() { return sender; },
      createDataChannel() { return channel; },
      async createOffer() { return { type: "offer", sdp: "v=0\r\noffer" }; },
      async setLocalDescription(offer) { this.localDescription = offer; },
      async setRemoteDescription(answer) { this.remoteDescription = answer; },
      async getStats() {
        return new Map([
          ["audio", { type: "inbound-rtp", kind: "audio", packetsLost: 1, packetsReceived: 99, jitter: 0.01 }],
          ["pair", { type: "candidate-pair", state: "succeeded", currentRoundTripTime: 0.05 }],
        ]);
      },
      close() { this.closeCalls += 1; this.connectionState = "closed"; },
    };
    peers.push(peer);
    channels.push({ channel, sent });
    senders.push(sender);
    return peer;
  }

  const client = createRealtimeClient({
    api,
    microphone,
    audioPlayback,
    createPeerConnection,
    onEvent: (event) => events.push(event),
  });

  return {
    client, events, apiCalls, microphoneCalls, audioCalls,
    peers, channels, senders, track, stream,
  };
}

test("forwards the fixed restaurant scenario when creating a realtime session", async () => {
  const h = createHarness();
  await h.client.start({ scenarioId: "child-restaurant-ordering" });

  assert.deepEqual(h.apiCalls.createOptions, [{
    prompt: "",
    conversation_id: null,
    scenario_id: "child-restaurant-ordering",
  }]);
  await h.client.stop();
});

test("deduplicates start and keeps media gated until session.created", async () => {
  const h = createHarness();
  const [first, second] = await Promise.all([
    h.client.start({ conversationId: "conversation-1" }),
    h.client.start({ conversationId: "conversation-1" }),
  ]);
  assert.equal(first.sessionId, "session-1");
  assert.deepEqual(second, first);
  assert.equal(h.apiCalls.create, 1);
  assert.equal(h.microphoneCalls.request, 1);
  assert.equal(h.peers.length, 1);
  assert.deepEqual(h.senders[0].replacements, [null]);
  assert.equal(h.track.enabled, false);

  h.channels[0].channel.onmessage({ data: JSON.stringify({ type: "session.created", session: { id: "sess_0123456789abcdef" } }) });
  await flush();
  assert.equal(h.senders[0].replacements.at(-1), h.track);
  assert.equal(h.track.enabled, true);
  assert.deepEqual(h.apiCalls.bind, [{ sessionId: "session-1", providerSessionId: "sess_0123456789abcdef" }]);
  assert.equal(h.channels[0].sent.filter((event) => event.type === "session.update").length, 1);

  h.channels[0].channel.onmessage({ data: JSON.stringify({ type: "session.updated" }) });
  h.channels[0].channel.onmessage({ data: JSON.stringify({ type: "session.updated" }) });
  await flush();
  assert.equal(h.channels[0].sent.filter((event) => event.type === "response.create").length, 1);
});

test("uses the shared data channel for text, final event persistence and tools", async () => {
  const h = createHarness();
  await h.client.start();
  h.client.sendText("  Hello there  ");
  assert.equal(h.channels[0].sent.at(-2).type, "conversation.item.create");
  assert.equal(h.channels[0].sent.at(-2).item.content[0].text, "Hello there");
  assert.equal(h.channels[0].sent.at(-1).type, "response.create");
  assert.equal(h.events.some((event) => event.type === "local.text" && event.text === "Hello there"), true);

  const finalEvent = { type: "response.text.done", response_id: "response-1", text: "Hi!" };
  h.channels[0].channel.onmessage({ data: JSON.stringify(finalEvent) });
  await flush();
  assert.deepEqual(h.apiCalls.remember, [{ sessionId: "session-1", event: finalEvent }]);

  h.channels[0].channel.onmessage({ data: JSON.stringify({
    type: "response.function_call_arguments.done",
    name: "update_learner_level",
    call_id: "call-1",
    arguments: JSON.stringify({ requested_level: 4, reason: "stable" }),
  }) });
  await flush();
  assert.equal(h.apiCalls.update.length, 1);
  assert.equal(h.channels[0].sent.some((event) => event.item?.type === "function_call_output"), true);
});

test("attaches remote audio and keeps mute separate from pause", async () => {
  const h = createHarness();
  await h.client.start();
  const remoteStream = { getAudioTracks: () => [{ kind: "audio" }] };
  h.peers[0].ontrack({ streams: [remoteStream] });
  await flush();
  assert.deepEqual(h.audioCalls.attach, [remoteStream]);

  assert.equal(h.client.setMuted(true), true);
  await h.client.setPaused(true);
  assert.deepEqual(h.microphoneCalls.muted, [true]);
  assert.deepEqual(h.microphoneCalls.paused, [true]);
  assert.deepEqual(h.audioCalls.paused, [true]);
  assert.equal(h.events.some((event) => event.type === "local.muted"), true);
  assert.equal(h.events.some((event) => event.type === "local.paused"), true);

  await h.client.setPaused(false);
  assert.deepEqual(h.audioCalls.paused, [true, false]);
  assert.equal(h.events.some((event) => event.type === "local.resumed"), true);
});

test("performs one teardown on disconnect, records quality, and supports explicit retry", async () => {
  const h = createHarness();
  await h.client.start({ conversationId: "conversation-1" });
  h.peers[0].connectionState = "failed";
  h.peers[0].onconnectionstatechange();
  h.peers[0].onconnectionstatechange();
  await flush();
  await flush();

  assert.equal(h.microphoneCalls.stop, 1);
  assert.equal(h.audioCalls.stop, 1);
  assert.equal(h.peers[0].closeCalls, 1);
  assert.equal(h.channels[0].channel.closeCalls, 1);
  assert.deepEqual(h.apiCalls.close, ["session-1"]);
  assert.equal(h.apiCalls.quality.length, 1);
  assert.equal(h.events.filter((event) => event.type === "local.disconnected").length, 1);
  assert.equal(h.client.isActive(), false);

  const retried = await h.client.retry();
  assert.equal(retried.sessionId, "session-2");
  assert.equal(h.apiCalls.create, 2);
  assert.equal(h.peers.length, 2);

  await h.client.stop();
  await h.client.stop();
  assert.equal(h.peers[1].closeCalls, 1);
  assert.equal(h.events.filter((event) => event.type === "local.ended").length, 1);
});
