const stages = ["START", "GREETING", "COLLECTING_INFORMATION", "CONFIRMATION", "COMPLETED", "CLOSING"];
const $ = id => document.getElementById(id);
const escapeHtml = value => String(value).replace(/[&<>'"]/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
}[char]));
const eventId = prefix => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

let session = null;
let peer = null;
let channel = null;
let localStream = null;
let audioSender = null;
let pollTimer = null;
let configured = false;
let muted = false;
let sentControlCount = 0;
let naturalCloseArmed = false;
let naturalCloseTimer = null;
let assistantResponseActive = false;
let lastResponseDoneAt = 0;
let lastUserTranscriptAt = 0;
let realtimeConfig = null;
const streamingCaptions = { USER: "", AI: "" };
const promptDefaultsReady = jsonRequest("/api/demo/config")
  .then(defaults => {
    ["coach", "difficulty", "speed", "correction"].forEach(key => {
      if (defaults[key] && $(key).querySelector(`option[value="${defaults[key]}"]`)) {
        $(key).value = defaults[key];
      }
    });
  })
  .catch(() => undefined);

async function jsonRequest(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || "GET",
    headers: { "Content-Type": "application/json" },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const body = await response.json();
  if (!response.ok || body?.success === false) throw new Error(body?.message || `请求失败 (${response.status})`);
  return body?.data ?? body;
}

function normalizeSdp(sdp) {
  const value = String(sdp || "").trim().replace(/\r?\n/g, "\r\n");
  return value.endsWith("\r\n") ? value : `${value}\r\n`;
}

function waitForIce() {
  if (peer.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("ICE 候选收集超时")), 10000);
    peer.addEventListener("icegatheringstatechange", () => {
      if (peer.iceGatheringState === "complete") { clearTimeout(timeout); resolve(); }
    });
  });
}

function waitForChannel() {
  if (channel.readyState === "open") return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Realtime 数据通道连接超时")), 10000);
    channel.addEventListener("open", () => { clearTimeout(timeout); resolve(); }, { once: true });
    channel.addEventListener("error", () => { clearTimeout(timeout); reject(new Error("Realtime 数据通道失败")); }, { once: true });
  });
}

function sendProvider(event) {
  if (channel?.readyState === "open") channel.send(JSON.stringify(event));
}

async function forwardTranscript(speaker, transcript) {
  if (!transcript?.trim() || !session) return;
  const sessionId = session.id;
  const updated = await jsonRequest(`/api/demo/sessions/${sessionId}/transcripts`, {
    method: "POST", body: { speaker, transcript }
  });
  if (session?.id === sessionId) {
    session = updated;
    streamingCaptions[speaker] = "";
    render();
  }
}

async function handleProviderMessage(raw) {
  let event;
  try { event = JSON.parse(raw); } catch { return; }
  if (event.type === "session.created") {
    await audioSender.replaceTrack(localStream.getAudioTracks()[0]);
    localStream.getAudioTracks()[0].enabled = !muted;
    sendProvider({
      event_id: eventId("scenario_config"),
      type: "session.update",
      session: realtimeConfig.session
    });
    $("promptStatus").textContent = "完整后端配置已发送，等待 Qwen 确认…";
    return;
  }
  if (event.type === "session.updated" && !configured) {
    const expectedPrompt = realtimeConfig?.session?.instructions || "";
    const appliedPrompt = event.session?.instructions || "";
    const expectedVoice = realtimeConfig?.session?.voice || "";
    const appliedVoice = event.session?.voice || "";
    if (!expectedPrompt || appliedPrompt !== expectedPrompt || appliedVoice !== expectedVoice) {
      $("promptStatus").textContent = `注入校验失败：Qwen 回执中的 Prompt 或音色与后端配置不一致`;
      $("promptStatus").classList.add("error");
      return;
    }
    configured = true;
    $("promptStatus").classList.remove("error");
    $("promptStatus").textContent =
      `Qwen 已确认 Prompt 注入 · ${realtimeConfig.promptLength} 字符 · voice=${appliedVoice} · SHA-256 ${realtimeConfig.promptSha256.slice(0, 12)}…`;
    sendProvider({ event_id: eventId("initial_response"), type: "response.create" });
  }
  if (event.type === "response.created") assistantResponseActive = true;
  if (event.type === "response.created") streamingCaptions.AI = "";
  if (event.type === "response.done") {
    assistantResponseActive = false;
    lastResponseDoneAt = Date.now();
    if (naturalCloseArmed) scheduleFinalDisconnect(650);
  }
  if (event.type === "input_audio_buffer.speech_started") {
    streamingCaptions.USER = "";
  }
  if (event.type === "conversation.item.input_audio_transcription.delta") {
    streamingCaptions.USER += event.delta || event.transcript || "";
    render();
  }
  if (event.type === "conversation.item.input_audio_transcription.completed") {
    lastUserTranscriptAt = Date.now();
    streamingCaptions.USER = event.transcript || event.text || streamingCaptions.USER;
    render();
    void forwardTranscript("USER", streamingCaptions.USER);
  }
  if (event.type === "response.audio_transcript.delta") {
    streamingCaptions.AI += event.delta || event.transcript || "";
    render();
  }
  if (event.type === "response.audio_transcript.done") {
    streamingCaptions.AI = event.transcript || event.text || streamingCaptions.AI;
    render();
    void forwardTranscript("AI", streamingCaptions.AI);
  }
  if (event.type === "error") {
    $("connection").textContent = `模型错误：${event.error?.message || event.message || "未知错误"}`;
  }
}

async function startCall() {
  $("start").disabled = true;
  $("connection").textContent = "正在用 Qwen 生成自定义场景…";
  try {
    await promptDefaultsReady;
    session = await jsonRequest("/api/demo/sessions", {
      method: "POST",
      body: {
        topic: $("topic").value,
        profile: {
          coach: $("coach").value,
          difficulty: $("difficulty").value,
          speed: $("speed").value,
          correction: $("correction").value,
          memory: $("memory").value
        }
      }
    });
    realtimeConfig = await jsonRequest(`/api/realtime/config/${session.id}`);
    if (!realtimeConfig?.session?.instructions) {
      throw new Error("后端没有生成 Realtime instructions");
    }
    $("promptStatus").classList.remove("error");
    $("promptStatus").textContent =
      `后端配置已生成 · ${realtimeConfig.promptLength} 字符 · voice=${realtimeConfig.session.voice} · SHA-256 ${realtimeConfig.promptSha256.slice(0, 12)}…`;
    $("promptPreview").textContent = realtimeConfig.session.instructions;
    $("promptDetails").hidden = false;
    render();
    $("connection").textContent = "正在连接 Qwen Realtime…";
    peer = new RTCPeerConnection();
    peer.ontrack = event => { if (event.streams?.[0]) $("remoteAudio").srcObject = event.streams[0]; };
    peer.onconnectionstatechange = () => { $("connection").textContent = `Realtime：${peer.connectionState}`; };
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    });
    const track = localStream.getAudioTracks()[0];
    track.enabled = false;
    audioSender = peer.addTrack(track, localStream);
    await audioSender.replaceTrack(null);
    channel = peer.createDataChannel("oai-events");
    channel.onmessage = message => void handleProviderMessage(message.data);
    peer.ondatachannel = event => { event.channel.onmessage = message => void handleProviderMessage(message.data); };

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    await waitForIce();
    const backend = await jsonRequest("/api/realtime/connect", {
      method: "POST",
      body: { offerSdp: peer.localDescription?.sdp || offer.sdp }
    });
    await peer.setRemoteDescription({ type: "answer", sdp: normalizeSdp(backend.answerSdp) });
    await waitForChannel();
    pollTimer = setInterval(pollState, 700);
    $("mute").disabled = false;
    $("stop").disabled = false;
    $("connection").textContent = "已连接，请直接用英语说话";
  } catch (error) {
    $("connection").textContent = `启动失败：${error.message}`;
    stopCall();
    $("start").disabled = false;
  }
}

async function pollState() {
  if (!session) return;
  try {
    session = await jsonRequest(`/api/demo/sessions/${session.id}`);
    if (session.controlInstructions.length > sentControlCount) {
      session.controlInstructions.slice(sentControlCount).forEach(control => {
        sendProvider({
          event_id: eventId("scenario_complete"),
          type: "session.update",
          session: { instructions: `${realtimeConfig.session.instructions}\n\n${control.instruction}` }
        });
      });
      sentControlCount = session.controlInstructions.length;
    }
    render();
    if (session.stage === "COMPLETED" && !naturalCloseArmed) armNaturalClose();
  } catch (error) {
    $("connection").textContent = `状态同步失败：${error.message}`;
  }
}

function armNaturalClose() {
  naturalCloseArmed = true;
  const track = localStream?.getAudioTracks()[0];
  if (track) track.enabled = false;
  $("mute").disabled = true;
  $("connection").textContent = "任务已确认，麦克风已关闭，等待 AI 最后一句…";

  if (!assistantResponseActive && lastResponseDoneAt > lastUserTranscriptAt) {
    scheduleFinalDisconnect(900);
  } else {
    scheduleFinalDisconnect(5_000);
  }
}

function scheduleFinalDisconnect(delay) {
  clearTimeout(naturalCloseTimer);
  naturalCloseTimer = setTimeout(finalizeNaturalClose, delay);
}

async function finalizeNaturalClose() {
  if (!session || !naturalCloseArmed) return;
  try {
    session = await jsonRequest(`/api/demo/sessions/${session.id}/close`, { method: "POST" });
    render();
  } catch { /* Always close the media transport even if state sync fails. */ }
  stopCall();
  $("connection").textContent = "场景已自然结束，麦克风和连接均已关闭";
}

function stopCall() {
  clearInterval(pollTimer);
  clearTimeout(naturalCloseTimer);
  pollTimer = null;
  naturalCloseTimer = null;
  channel?.close();
  if (peer) peer.onconnectionstatechange = null;
  peer?.close();
  localStream?.getTracks().forEach(track => track.stop());
  channel = peer = localStream = audioSender = null;
  configured = false;
  naturalCloseArmed = false;
  assistantResponseActive = false;
  lastResponseDoneAt = 0;
  lastUserTranscriptAt = 0;
  streamingCaptions.USER = "";
  streamingCaptions.AI = "";
  $("mute").disabled = true;
  $("stop").disabled = true;
  $("start").disabled = false;
}

function render() {
  if (!session) return;
  const current = stages.indexOf(session.stage);
  $("flow").innerHTML = stages.map((stage, index) =>
    `<div class="stage ${index === current ? "active" : index < current ? "past" : ""}">${stage}</div>`
  ).join("");
  $("status").textContent = session.processingEvents ? `${session.status} · 分析中 ${session.processingEvents}` : session.status;
  const liveSpeaker = streamingCaptions.USER ? "USER" : streamingCaptions.AI ? "AI" : null;
  $("turnCount").textContent = `${session.conversation.length}${liveSpeaker ? " + live" : ""} turns`;
  $("revision").textContent = session.lastError ? `抽取错误：${session.lastError}` : `修正次数：${session.revision}`;
  const profile = session.definition.promptProfile;
  $("definition").innerHTML = `<strong>${escapeHtml(session.definition.goal)}</strong><br>AI：${escapeHtml(session.definition.aiRole)} · 你：${escapeHtml(session.definition.userRole)}<br>教练：${escapeHtml(profile.coach)} · 难度：${escapeHtml(profile.difficulty)} · 语速：${escapeHtml(profile.speed)} · 纠错：${escapeHtml(profile.correction)}`;
  $("slots").innerHTML = Object.entries(session.definition.requiredSlots).map(([key, description]) =>
    `<div><dt title="${escapeHtml(description)}">${escapeHtml(key)}</dt><dd class="${session.order[key] ? "" : "missing"}">${escapeHtml(session.order[key] || "未完成")}</dd></div>`
  ).join("");
  const visibleTurns = session.conversation.map(turn => ({ ...turn, streaming: false }));
  if (liveSpeaker) visibleTurns.push({ speaker: liveSpeaker, text: streamingCaptions[liveSpeaker], streaming: true });
  $("conversation").classList.toggle("empty", !visibleTurns.length);
  $("conversation").innerHTML = visibleTurns.length
    ? visibleTurns.map(turn => `<div class="turn ${turn.speaker.toLowerCase()} ${turn.streaming ? "streaming" : ""}"><span class="speaker">${turn.speaker}${turn.streaming ? " · LIVE" : ""}</span>${escapeHtml(turn.text)}</div>`).join("")
    : "已生成场景，等待真实模型转写";
  $("events").classList.toggle("empty", !session.events.length);
  $("events").innerHTML = session.events.length
    ? session.events.slice().reverse().map(event => `<div class="event"><strong>${event.type} · ${(event.confidence * 100).toFixed(0)}%</strong><code>${escapeHtml(JSON.stringify(event.values))}</code></div>`).join("")
    : "暂无事件";
  $("controls").classList.toggle("empty", !session.controlInstructions.length);
  $("controls").innerHTML = session.controlInstructions.length
    ? session.controlInstructions.map(control => `<div class="control"><code>${control.type}</code>${escapeHtml(control.instruction)}</div>`).join("")
    : "尚未触发 session.update";
}

$("start").addEventListener("click", startCall);
$("stop").addEventListener("click", () => { stopCall(); $("connection").textContent = "通话已结束"; });
$("mute").addEventListener("click", () => {
  muted = !muted;
  const track = localStream?.getAudioTracks()[0];
  if (track) track.enabled = !muted;
  $("mute").textContent = muted ? "取消静音" : "静音";
});

$("flow").innerHTML = stages.map(stage => `<div class="stage">${stage}</div>`).join("");
