import test from "node:test";
import assert from "node:assert/strict";

import { createRealtimeClient } from "../src/realtime/realtime-client.mjs";

class FakeChannel {
  constructor() { this.readyState = "open"; this.sent = []; }
  send(value) { this.sent.push(JSON.parse(value)); }
  close() { this.readyState = "closed"; }
}

class FakePeerConnection {
  constructor() { this.channel = new FakeChannel(); this.connectionState = "new"; this.senders = []; }
  createDataChannel() { return this.channel; }
  addTrack(track) { const sender = { track, replaceTrack: async (next) => { sender.track = next; } }; this.senders.push(sender); return sender; }
  getSenders() { return this.senders; }
  async createOffer() { return { type: "offer", sdp: "offer-sdp" }; }
  async setLocalDescription(value) { this.localDescription = value; this.iceGatheringState = "complete"; }
  async setRemoteDescription(value) { this.remoteDescription = value; }
  close() { this.connectionState = "closed"; }
}

test("starts a WebRTC session through the backend proxy and can send text", async () => {
  const calls = [];
  const track = { enabled: true, stopCalled: false, stop() { this.stopCalled = true; } };
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
  const api = {
    createSession: async () => ({ session_id: "s1", session_config: { instructions: "coach" }, history: [] }),
    exchangeSdp: async (id, sdp) => { calls.push([id, sdp]); return "answer-sdp"; },
    rememberEvent: async () => {},
    closeSession: async () => {},
  };
  const peer = new FakePeerConnection();
  const client = createRealtimeClient({ api, mediaDevices: { getUserMedia: async () => stream }, createPeerConnection: () => peer });

  await client.start();
  assert.deepEqual(calls, [["s1", "offer-sdp"]]);
  assert.equal(peer.remoteDescription.sdp, "answer-sdp");

  peer.channel.onmessage({ data: JSON.stringify({ type: "session.created" }) });
  peer.channel.onmessage({ data: JSON.stringify({ type: "session.updated" }) });
  client.sendText("Hello there");

  assert.equal(peer.channel.sent.some((event) => event.type === "session.update"), true);
  assert.equal(peer.channel.sent.some((event) => event.type === "response.create"), true);
  assert.equal(peer.channel.sent.some((event) => event.type === "conversation.item.create"), true);

  await client.stop();
  assert.equal(track.stopCalled, true);
  assert.equal(peer.connectionState, "closed");
});

test("mute toggles the live audio track without ending the session", async () => {
  const track = { enabled: true, stop() {} };
  const peer = new FakePeerConnection();
  const client = createRealtimeClient({
    api: { createSession: async () => ({ session_id: "s2", session_config: {} }), exchangeSdp: async () => "answer", closeSession: async () => {} },
    mediaDevices: { getUserMedia: async () => ({ getTracks: () => [track], getAudioTracks: () => [track] }) },
    createPeerConnection: () => peer,
  });
  await client.start();
  assert.equal(client.setMuted(true), true);
  assert.equal(track.enabled, false);
  assert.equal(client.setMuted(false), false);
  assert.equal(track.enabled, true);
});

test("returns learner-level tool results to the realtime model", async () => {
  const peer = new FakePeerConnection();
  const api = {
    createSession: async () => ({ session_id: "s3", session_config: {} }),
    exchangeSdp: async () => "answer",
    updateLearnerLevel: async (_id, payload) => ({ applied: true, applied_level: payload.arguments.requested_level }),
    closeSession: async () => {},
  };
  const track = { enabled: true, stop() {} };
  const client = createRealtimeClient({
    api,
    mediaDevices: { getUserMedia: async () => ({ getTracks: () => [track], getAudioTracks: () => [track] }) },
    createPeerConnection: () => peer,
  });
  await client.start();
  peer.channel.onmessage({ data: JSON.stringify({ type: "response.function_call_arguments.done", call_id: "call-1", arguments: '{"requested_level":5,"reason":"consistent fluency"}' }) });
  await new Promise((resolve) => setTimeout(resolve, 0));
  const output = peer.channel.sent.find((event) => event.item?.type === "function_call_output");
  assert.equal(output.item.call_id, "call-1");
  assert.match(output.item.output, /"applied":true/);
});

test("start does not resolve until the realtime data channel is open", async () => {
  const peer = new FakePeerConnection();
  peer.channel.readyState = "connecting";
  const track = { enabled: true, stop() {} };
  const client = createRealtimeClient({
    api: { createSession: async () => ({ session_id: "s4", session_config: {} }), exchangeSdp: async () => "answer", closeSession: async () => {} },
    mediaDevices: { getUserMedia: async () => ({ getTracks: () => [track], getAudioTracks: () => [track] }) },
    createPeerConnection: () => peer,
  });
  let started = false;
  const starting = client.start().then(() => { started = true; });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(started, false);
  peer.channel.readyState = "open";
  peer.channel.onopen();
  await starting;
  assert.equal(started, true);
});
