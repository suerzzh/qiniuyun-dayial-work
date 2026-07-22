import test from "node:test";
import assert from "node:assert/strict";
import { createIeltsSessionRuntime } from "../src/ielts/ielts-session-runtime.mjs";

const flush = () => new Promise((resolve) => setImmediate(resolve));

function transportHarness({ channel, peer, exchangeSdp, abandon, createAudio = () => null, runtimeOptions = {} } = {}) {
  const cleanup = { trackStops: 0, channelCloses: 0, peerCloses: 0, streamerStops: 0 };
  const abandonedAttemptIds = [];
  const track = { id: "mic", stop() { cleanup.trackStops += 1; } };
  const stream = { getAudioTracks: () => [track], getTracks: () => [track] };
  const activeChannel = channel || {
    readyState: "open", send() {}, close() { cleanup.channelCloses += 1; },
  };
  const activePeer = {
    iceGatheringState: "complete",
    addTrack() {},
    createDataChannel: () => activeChannel,
    createOffer: async () => ({ type: "offer", sdp: "offer" }),
    async setLocalDescription(offer) { this.localDescription = offer; },
    setRemoteDescription: async () => {},
    close() { cleanup.peerCloses += 1; },
    ...peer,
  };
  const runtime = createIeltsSessionRuntime({
    api: {
      createAttempt: async () => ({ attempt_id: "att-transport", scoring_ws_url: "/ws", realtime_session_config: {} }),
      exchangeSdp: exchangeSdp || (async () => "answer"),
      async abandon(attemptId) {
        abandonedAttemptIds.push(attemptId);
        return abandon?.(attemptId);
      },
    },
    streamer: {
      attach: async () => {}, control() {},
      async stop() { cleanup.streamerStops += 1; },
    },
    mediaDevices: { getUserMedia: async () => stream },
    createPeerConnection: () => activePeer,
    createAudio,
    ...runtimeOptions,
  });
  return { runtime, cleanup, abandonedAttemptIds, track, stream, channel: activeChannel, peer: activePeer };
}

test("IELTS transport waits for ICE gathering before exchanging SDP", async () => {
  let exchangeCalls = 0;
  const fixture = transportHarness({
    peer: { iceGatheringState: "gathering" },
    exchangeSdp: async () => { exchangeCalls += 1; return "answer"; },
  });
  const started = fixture.runtime.start({ mode: "full_mock", paperSnapshot: {} });
  await flush();
  assert.equal(exchangeCalls, 0);
  fixture.peer.iceGatheringState = "complete";
  fixture.peer.onicegatheringstatechange();
  await started;
  assert.equal(exchangeCalls, 1);
});

test("IELTS transport rejects when the DataChannel reports an opening error", async () => {
  let errorHandler = null;
  const channel = {
    readyState: "connecting", send() {}, close() {},
    set onerror(handler) { errorHandler = handler; queueMicrotask(() => errorHandler()); },
    get onerror() { return errorHandler; },
  };
  const fixture = transportHarness({ channel });
  await assert.rejects(
    fixture.runtime.start({ mode: "full_mock", paperSnapshot: {} }),
    /实时通道连接失败/,
  );
});

test("IELTS transport rejects when the DataChannel opening deadline expires", async () => {
  const channel = { readyState: "connecting", send() {}, close() {} };
  const fixture = transportHarness({
    channel,
    runtimeOptions: {
      transportTimeoutMs: 25,
      scheduleTransportTimeout(callback) { queueMicrotask(callback); return 1; },
      cancelTransportTimeout() {},
    },
  });
  await assert.rejects(
    fixture.runtime.start({ mode: "full_mock", paperSnapshot: {} }),
    /实时通道连接超时/,
  );
});

test("IELTS transport releases media, PCM, channel, peer and audio after startup failure", async () => {
  const audio = { srcObject: null, pauses: 0, play: async () => {}, pause() { this.pauses += 1; } };
  const fixture = transportHarness({
    createAudio: () => audio,
    peer: {
      async setLocalDescription(offer) {
        this.localDescription = offer;
        this.ontrack({ streams: [{ getAudioTracks: () => [{}] }] });
      },
    },
    exchangeSdp: async () => { throw new Error("SDP exchange failed"); },
  });
  await assert.rejects(
    fixture.runtime.start({ mode: "full_mock", paperSnapshot: {} }),
    /SDP exchange failed/,
  );
  assert.deepEqual(fixture.cleanup, {
    trackStops: 1, channelCloses: 1, peerCloses: 1, streamerStops: 1,
  });
  assert.deepEqual(fixture.abandonedAttemptIds, ["att-transport"]);
  assert.equal(audio.pauses, 1);
  assert.equal(audio.srcObject, null);
});

test("IELTS transport preserves the startup error when attempt abandonment also fails", async () => {
  const startupError = new Error("SDP exchange failed first");
  const fixture = transportHarness({
    exchangeSdp: async () => { throw startupError; },
    abandon: async () => { throw new Error("Attempt abandonment failed"); },
  });
  await assert.rejects(
    fixture.runtime.start({ mode: "full_mock", paperSnapshot: {} }),
    (error) => error === startupError,
  );
  assert.deepEqual(fixture.abandonedAttemptIds, ["att-transport"]);
});

test("IELTS runtime authorizes one microphone stream and feeds it to Realtime and PCM", async () => {
  const stream = { getAudioTracks: () => [{ id: "mic" }], getTracks: () => [{ stop() {} }] };
  let permissionCalls = 0;
  let pcmStream;
  const controls = [];
  const channel = { readyState: "open", send() {}, close() {} };
  const peer = {
    iceGatheringState: "complete",
    addTrack(track, supplied) { assert.equal(track.id, "mic"); assert.equal(supplied, stream); },
    createDataChannel: () => channel,
    createOffer: async () => ({ type: "offer", sdp: "offer" }),
    setLocalDescription: async function (offer) { this.localDescription = offer; },
    setRemoteDescription: async () => {}, close() {},
  };
  const streamer = { attach: async (supplied) => { pcmStream = supplied; }, control: (event) => controls.push(event), stop: async () => {} };
  const api = {
    createAttempt: async () => ({ attempt_id: "att-1", scoring_ws_url: "/api/ielts/scoring-stream?attempt_id=att-1", realtime_session_config: {} }),
    exchangeSdp: async () => "answer", abandon: async () => {},
  };
  const runtime = createIeltsSessionRuntime({ api, streamer,
    mediaDevices: { getUserMedia: async () => { permissionCalls += 1; return stream; } },
    createPeerConnection: () => peer, createAudio: () => null,
  });
  await runtime.start({ mode: "full_mock", paperSnapshot: {} });
  assert.equal(permissionCalls, 1);
  assert.equal(pcmStream, stream);

  const oldTurn = runtime.questionAsked({ part: 1, questionId: "q1", questionText: "Where do you live?" });
  channel.onmessage({ data: JSON.stringify({ type: "input_audio_buffer.speech_started", item_id: "item-old" }) });
  runtime.completeTurn("initial transcript");
  runtime.questionAsked({ part: 1, questionId: "q2", questionText: "What do you like?" });
  channel.onmessage({ data: JSON.stringify({ type: "conversation.item.input_audio_transcription.completed",
    item_id: "item-old", transcript: "late final words" }) });
  assert.ok(controls.some((event) => event.type === "turn.transcript_chunk"
    && event.turn_id === oldTurn && event.text.includes("late final words")));
});

function runtimeFixture({ reports = [{ scoring_status: "COMPLETE" }] } = {}) {
  const channel = { readyState: "open", sent: [], send(raw) { this.sent.push(JSON.parse(raw)); }, close() {} };
  const track = { enabled: true, stop() {} };
  const stream = { getAudioTracks: () => [track], getTracks: () => [track] };
  const peer = {
    iceGatheringState: "complete",
    addTrack() {}, createDataChannel: () => channel,
    createOffer: async () => ({ type: "offer", sdp: "offer" }),
    setLocalDescription: async function (offer) { this.localDescription = offer; },
    setRemoteDescription: async () => {}, close() {},
  };
  let reportCalls = 0;
  const api = {
    createAttempt: async () => ({ attempt_id: "att-live", scoring_ws_url: "/ws", realtime_session_config: {} }),
    exchangeSdp: async () => "answer", finalize: async () => ({}),
    report: async () => reports[Math.min(reportCalls++, reports.length - 1)],
  };
  const controls = [];
  const runtime = createIeltsSessionRuntime({ api,
    streamer: { attach: async () => {}, control: (event) => controls.push(event), stop: async () => {} },
    mediaDevices: { getUserMedia: async () => stream }, createPeerConnection: () => peer,
    createAudio: () => null, wait: async () => {},
  });
  return { runtime, channel, controls, reportCalls: () => reportCalls };
}

test("IELTS runtime streams Qwen confirmed and tentative ASR text before completion", async () => {
  const fixture = runtimeFixture();
  const transcriptEvents = [];
  const runtime = createIeltsSessionRuntime({
    api: {
      createAttempt: async () => ({ attempt_id: "att-delta", scoring_ws_url: "/ws", realtime_session_config: {} }),
      exchangeSdp: async () => "answer",
    },
    streamer: { attach: async () => {}, control() {}, stop: async () => {} },
    mediaDevices: { getUserMedia: async () => ({ getAudioTracks: () => [{ stop() {} }], getTracks: () => [{ stop() {} }] }) },
    createPeerConnection: () => ({
      iceGatheringState: "complete",
      addTrack() {}, createDataChannel: () => fixture.channel,
      createOffer: async () => ({ type: "offer", sdp: "offer" }),
      setLocalDescription: async function (offer) { this.localDescription = offer; },
      setRemoteDescription: async () => {}, close() {},
    }),
    createAudio: () => null, onTranscript: (event) => transcriptEvents.push(event),
  });
  await runtime.start({ mode: "practice_part", paperSnapshot: {} });
  runtime.questionAsked({ part: 1, questionId: "q1", questionText: "Do you study?" });
  fixture.channel.onmessage({ data: JSON.stringify({
    type: "conversation.item.input_audio_transcription.delta", item_id: "item-1",
    text: "I study computer", stash: " science",
  }) });
  assert.deepEqual(transcriptEvents.at(-1), { interim: "I study computer science" });
});

test("IELTS finalization keeps polling beyond the old fifteen-second ceiling", async () => {
  const reports = Array.from({ length: 31 }, () => ({ scoring_status: "SCORING" }));
  reports.push({ scoring_status: "COMPLETE", overallBand: 6.5 });
  const fixture = runtimeFixture({ reports });
  await fixture.runtime.start({ mode: "practice_part", paperSnapshot: {} });
  const report = await fixture.runtime.finalize();
  assert.equal(report.scoring_status, "COMPLETE");
  assert.equal(fixture.reportCalls(), 32);
});

test("IELTS examiner waits for Qwen session.updated before asking the first question", async () => {
  const fixture = runtimeFixture();
  await fixture.runtime.start({ mode: "full_mock", paperSnapshot: {} });
  fixture.runtime.questionAsked({ part: 1, questionId: "q-ready", questionText: "Do you work?" });
  assert.equal(fixture.channel.sent.some((event) => event.type === "response.create"), false);

  fixture.channel.onmessage({ data: JSON.stringify({ type: "session.created" }) });
  assert.equal(fixture.channel.sent.some((event) => event.type === "session.update"), true);
  fixture.channel.onmessage({ data: JSON.stringify({ type: "session.updated" }) });
  assert.equal(fixture.channel.sent.some((event) => event.type === "response.create"), true);
});

test("IELTS runtime reports examiner response.done before the controller starts candidate timing", async () => {
  const fixture = runtimeFixture();
  let completed = 0;
  await fixture.runtime.start({ mode: "full_mock", paperSnapshot: {} });
  fixture.runtime.examinerInstruction("Hello.", () => { completed += 1; });
  fixture.channel.onmessage({ data: JSON.stringify({ type: "session.updated" }) });
  assert.equal(completed, 0);
  fixture.channel.onmessage({ data: JSON.stringify({ type: "response.done", response: { id: "r1" } }) });
  assert.equal(completed, 1);
});

test("IELTS runtime times out a missing examiner response without corrupting the next callback", async () => {
  const fixture = runtimeFixture();
  const scheduled = [];
  const statuses = [];
  const runtime = createIeltsSessionRuntime({
    api: {
      createAttempt: async () => ({ attempt_id: "att-timeout", scoring_ws_url: "/ws", realtime_session_config: {} }),
      exchangeSdp: async () => "answer",
    },
    streamer: { attach: async () => {}, control() {}, stop: async () => {} },
    mediaDevices: { getUserMedia: async () => ({ getAudioTracks: () => [{ stop() {} }], getTracks: () => [{ stop() {} }] }) },
    createPeerConnection: () => ({
      iceGatheringState: "complete",
      addTrack() {}, createDataChannel: () => fixture.channel,
      createOffer: async () => ({ type: "offer", sdp: "offer" }),
      setLocalDescription: async function (offer) { this.localDescription = offer; },
      setRemoteDescription: async () => {}, close() {},
    }),
    createAudio: () => null,
    examinerResponseTimeoutMs: 30_000,
    scheduleTimeout(callback) { scheduled.push(callback); return scheduled.length; },
    cancelTimeout() {},
    onStatus: (event) => statuses.push(event),
  });
  let firstCompleted = 0;
  let secondCompleted = 0;
  await runtime.start({ mode: "full_mock", paperSnapshot: {} });
  runtime.examinerInstruction("Hello.", () => { firstCompleted += 1; });
  fixture.channel.onmessage({ data: JSON.stringify({ type: "session.updated" }) });
  fixture.channel.onmessage({ data: JSON.stringify({ type: "response.created", response: { id: "r1" } }) });

  scheduled[0]();
  assert.equal(firstCompleted, 1);
  assert.equal(statuses.at(-1).type, "local.examiner_response_timeout");

  runtime.questionAsked({ part: 1, questionId: "q1", questionText: "Do you work?",
    onDone: () => { secondCompleted += 1; } });
  fixture.channel.onmessage({ data: JSON.stringify({ type: "response.created", response: { id: "r2" } }) });
  fixture.channel.onmessage({ data: JSON.stringify({ type: "response.done", response: { id: "r1" } }) });
  assert.equal(secondCompleted, 0);
  fixture.channel.onmessage({ data: JSON.stringify({ type: "response.done", response: { id: "r2" } }) });
  assert.equal(secondCompleted, 1);
});

test("IELTS runtime opens an Introduction turn on the shared PCM stream but marks it ineligible", async () => {
  const fixture = runtimeFixture();
  await fixture.runtime.start({ mode: "full_mock", paperSnapshot: {} });
  const turnId = fixture.runtime.openTurn({
    part: 0, questionId: "introduction", questionText: "Please introduce yourself.",
    turnType: "INTRODUCTION", scoringEligible: false,
  });
  fixture.runtime.completeTurn("My name is Lin.", "USER_DONE");
  const opened = fixture.controls.find((event) => event.type === "turn.opened" && event.turn_id === turnId);
  assert.equal(opened.part, 0);
  assert.equal(opened.turn_type, "INTRODUCTION");
  assert.equal(opened.scoring_eligible, false);
});
