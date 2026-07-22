import { createInitialState, createStore } from "./state.mjs";
import { CEFR_LEVELS, SPEED_META, learningAssets, pronunciationHistory, sentences } from "./data.mjs";
import { globalSection, parseRoute } from "./router.mjs";
import { renderConversation } from "./views/conversation.mjs";
import { renderScenes } from "./views/scenes.mjs";
import { renderTraining } from "./views/training.mjs";
import { renderReview, renderReviewDetail } from "./views/review.mjs";
import { renderProfile } from "./views/profile.mjs";
import { renderAuth } from "./views/auth.mjs";
import { renderMembership } from "./views/membership.mjs";
import { renderCustomSceneGenerating, renderCustomScenePreview } from "./views/custom_scene.mjs";
import { renderIelts, voicePresentation } from "./views/ielts.mjs";
import { createIeltsDemoController } from "./ielts/demo-controller.mjs";
import { createVoiceAnswerController } from "./ielts/voice-answer-controller.mjs";
import { createIeltsApi } from "./services/ielts-api.mjs";
import { createPcmScoringStreamer } from "./ielts/pcm-scoring-streamer.mjs";
import { createIeltsRealtimeSpeechAdapter, createIeltsSessionRuntime } from "./ielts/ielts-session-runtime.mjs";
import { createRealtimeApi } from "./services/realtime-api.mjs";
import { createRealtimeClient } from "./realtime/realtime-client.mjs";
import { applyRealtimeEvent, createRealtimeState } from "./realtime/realtime-state.mjs";
import { IELTS_BACKEND_URL, SUPABASE_PUBLIC_CONFIG } from "./runtime-config.mjs";

const root = document.getElementById("app-root");
const shell = document.getElementById("app-shell");
const toast = document.getElementById("toast");
let toastTimer;

function readSaved() {
  try { return JSON.parse(localStorage.getItem("unispeaking-ui") || "{}"); }
  catch { return {}; }
}
const store = createStore(createInitialState(readSaved()));

const ieltsApi = createIeltsApi({ baseUrl: IELTS_BACKEND_URL });
const pcmStreamer = createPcmScoringStreamer({
  createAudioContext: (options) => new (window.AudioContext || window.webkitAudioContext)(options),
  createWebSocket: (url) => new WebSocket(url),
  onEvent: () => {},
});
let ieltsSpeechAdapter = null;
let voiceAnswerController = null;
const ieltsRuntime = createIeltsSessionRuntime({
  api: ieltsApi,
  streamer: pcmStreamer,
  mediaDevices: navigator.mediaDevices,
  createPeerConnection: () => new RTCPeerConnection({ iceServers: [] }),
  createAudio: () => new Audio(),
  wsBaseUrl: IELTS_BACKEND_URL.replace(/^http/, "ws"),
  onTranscript: (event) => ieltsSpeechAdapter?.receive(event),
});

const ieltsController = createIeltsDemoController({
  async loadJson(name) {
    const response = await fetch(`./backend/ielts/question_bank/${name}`);
    if (!response.ok) throw new Error(`题库加载失败：${name} (${response.status})`);
    return response.json();
  },
  storage: localStorage,
  // Examiner speech and ASR are supplied by Qwen Realtime in the IELTS runtime.
  speak: () => {},
  runtime: ieltsRuntime,
  onAnswerTimeLimit() {
    if (!voiceAnswerController) return "";
    const transcript = voiceAnswerController.finish();
    queueMicrotask(() => voiceAnswerController?.reset());
    return transcript;
  },
  onTimer(snapshot) {
    if (parseRoute(location.hash).name === "ielts") updateIeltsTimingView(snapshot);
  },
  onChange() {
    if (parseRoute(location.hash).name === "ielts") render();
  },
});
voiceAnswerController = createVoiceAnswerController({
  createAdapter: (handlers) => {
    ieltsSpeechAdapter = createIeltsRealtimeSpeechAdapter(ieltsRuntime, handlers);
    return ieltsSpeechAdapter;
  },
  onChange() {
    if (parseRoute(location.hash).name === "ielts") updateIeltsVoiceView();
  },
});
const realtimeApi = createRealtimeApi({
  baseUrl: SUPABASE_PUBLIC_CONFIG.url,
  publishableKey: SUPABASE_PUBLIC_CONFIG.publishableKey,
});
const realtimeClient = createRealtimeClient({
  api: realtimeApi,
  mediaDevices: navigator.mediaDevices,
  createPeerConnection: () => new RTCPeerConnection({ iceServers: [] }),
  onEvent(event) {
    const current = store.getState().realtime || createRealtimeState();
    const realtime = applyRealtimeEvent(current, event);
    store.setState({ realtime, muted: realtime.muted, voiceState: realtime.status === "listening" ? "listening" : "ready" });
    render();
    if (event.type === "local.error") showToast(event.message || "实时连接失败");
  },
});

async function startRealtime(prompt = "") {
  store.setState({ activeConversation: "new", realtime: { ...createRealtimeState(), status: "connecting" }, textOpen: true });
  render();
  try { await realtimeClient.start({ prompt }); }
  catch { /* realtime client has already published a safe UI error */ }
}

async function endRealtime() {
  if (realtimeClient.isActive()) await realtimeClient.stop();
  store.resetConversation();
  store.setState({ realtime: createRealtimeState(), muted: false });
  render();
}
store.subscribe((state) => {
  try {
    localStorage.setItem("unispeaking-ui", JSON.stringify({
      settings: state.settings,
      theme: state.theme,
      activeConversation: state.activeConversation,
      user: state.user,
      membership: state.membership,
      hasCheckedIn: state.hasCheckedIn,
      masteryStatus: state.masteryStatus,
      customSceneConfig: state.customSceneConfig,
      pronunciationHistory: state.pronunciationHistory
    }));
  }
  catch { /* local storage can be disabled without blocking the prototype */ }
});

function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("show");
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function updateGlobalNav(route) {
  const current = globalSection(route);
  document.querySelectorAll("[data-global]").forEach((link) => {
    const active = link.dataset.global === current;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page"); else link.removeAttribute("aria-current");
  });
}

function captureIeltsNotesFocus(route) {
  const active = document.activeElement;
  if (route.name !== "ielts" || !active?.matches?.("[data-action='ielts-update-notes']")) return null;
  return {
    start: active.selectionStart,
    end: active.selectionEnd,
    direction: active.selectionDirection,
  };
}

function restoreIeltsNotesFocus(focusState) {
  if (!focusState) return false;
  const notes = root.querySelector("[data-action='ielts-update-notes']:not([readonly])");
  if (!notes) return false;
  notes.focus({ preventScroll: true });
  notes.setSelectionRange(focusState.start, focusState.end, focusState.direction || "none");
  return true;
}

function captureIeltsVoiceFocus(route) {
  const active = document.activeElement;
  if (route.name !== "ielts" || !active?.matches?.("[data-action='ielts-voice-transcript']")) return null;
  return { start: active.selectionStart, end: active.selectionEnd, direction: active.selectionDirection };
}

function restoreIeltsVoiceFocus(focusState) {
  if (!focusState) return false;
  const transcript = root.querySelector("[data-action='ielts-voice-transcript']");
  if (!transcript) return false;
  transcript.focus({ preventScroll: true });
  transcript.setSelectionRange(focusState.start, focusState.end, focusState.direction || "none");
  return true;
}

function updateIeltsVoiceView() {
  const session = ieltsController.getSnapshot();
  const panel = root.querySelector(".ielts-voice-panel");
  if (session.screen !== "session" || session.exam?.status === "part2_preparing" || !panel) {
    render();
    return;
  }
  const voice = voiceAnswerController.getSnapshot();
  const presentation = voicePresentation(voice);
  panel.className = `ielts-voice-panel panel is-${voice.status}`;

  const elapsed = panel.querySelector("header time");
  if (elapsed) elapsed.textContent = presentation.elapsedText;

  const microphone = panel.querySelector(".ielts-mic-button");
  if (microphone) {
    microphone.className = `ielts-mic-button is-${voice.status}`;
    microphone.dataset.action = presentation.action;
    microphone.setAttribute("aria-label", presentation.hint);
    microphone.disabled = Boolean(presentation.disabled);
    const label = microphone.querySelector("b");
    if (label) label.textContent = presentation.label;
  }

  const status = panel.querySelector(".ielts-voice-status");
  if (status) status.textContent = presentation.statusMessage;
  const finish = panel.querySelector("[data-action='ielts-voice-finish']");
  if (finish) finish.disabled = presentation.finishDisabled;
  const transcript = panel.querySelector("[data-action='ielts-voice-transcript']");
  if (transcript && transcript.value !== voice.finalTranscript) transcript.value = voice.finalTranscript;

  const transcriptContainer = panel.querySelector(".ielts-transcript");
  let interim = transcriptContainer?.querySelector("small");
  if (voice.interimTranscript) {
    if (!interim && transcriptContainer) {
      interim = document.createElement("small");
      transcriptContainer.append(interim);
    }
    if (interim) interim.textContent = voice.interimTranscript;
  } else {
    interim?.remove();
  }
}

function updateIeltsTimingView(snapshot) {
  if (snapshot.screen !== "session") return;
  const timer = root.querySelector(".ielts-session-tools > time");
  if (timer) {
    const seconds = snapshot.timer?.remainingSeconds;
    timer.textContent = seconds == null ? "LIVE"
      : `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  }
  const part3 = root.querySelector(".ielts-part3-timing");
  if (part3 && snapshot.part3Timer) {
    const format = (value) => `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
    const heading = part3.querySelector("strong");
    if (heading) heading.textContent = `Part 3 总计时 ${format(snapshot.part3Timer.elapsedSeconds)}`;
    part3.classList.toggle("is-soft-limit", Boolean(snapshot.part3Timer.softLimitReached));
  }
}

function render() {
  const route = parseRoute(location.hash);
  const ieltsNotesFocus = captureIeltsNotesFocus(route);
  const ieltsVoiceFocus = captureIeltsVoiceFocus(route);
  if (route.invalid) {
    history.replaceState(null, "", "#/conversation");
    showToast("页面不存在，已返回自由对话");
  }
  updateGlobalNav(route);
  const state = store.getState();
  document.body.dataset.theme = state.theme;
  root.dataset.route = route.name;

  // Update dynamic user entry card in header
  const userNav = document.getElementById("user-nav-entry");
  if (userNav) {
    if (state.user) {
      userNav.href = "#/profile/overview";
      userNav.innerHTML = `<span class="user-avatar">${state.user.name[0]}</span><span>${state.user.name}</span>`;
      userNav.className = "user-entry";
    } else {
      userNav.href = "#/auth";
      userNav.innerHTML = `<span>登录 / 注册</span>`;
      userNav.className = "user-entry logged-out-entry";
    }
  }

  if (route.name === "ielts") root.innerHTML = renderIelts(ieltsController.getSnapshot(), voiceAnswerController.getSnapshot());
  else if (route.name === "scenes") root.innerHTML = renderScenes(state);
  else if (route.name === "training") root.innerHTML = renderTraining(route.params.stage, state);
  else if (route.name === "review") root.innerHTML = renderReview(state);
  else if (route.name === "review-detail") root.innerHTML = renderReviewDetail(state);
  else if (route.name === "profile") root.innerHTML = renderProfile(route.params.section, state);
  else if (route.name === "auth") root.innerHTML = renderAuth(state);
  else if (route.name === "membership") root.innerHTML = renderMembership(state);
  else if (route.name === "custom-scene-generating") {
    root.innerHTML = renderCustomSceneGenerating(state);
    // Simulate generation logs and redirect
    setTimeout(() => {
      const step2 = document.getElementById("log-step-2");
      if (step2) step2.classList.add("active");
    }, 500);
    setTimeout(() => {
      const step3 = document.getElementById("log-step-3");
      if (step3) step3.classList.add("active");
    }, 1000);
    setTimeout(() => {
      const step4 = document.getElementById("log-step-4");
      if (step4) step4.classList.add("active");
    }, 1500);
    setTimeout(() => {
      if (location.hash === "#/custom-scene/generating") {
        location.hash = "#/custom-scene/preview";
      }
    }, 2200);
  }
  else if (route.name === "custom-scene-preview") root.innerHTML = renderCustomScenePreview(state);
  else root.innerHTML = renderConversation(state);

  shell.classList.toggle("mobile-nav-open", state.mobileNavOpen);
  if (!restoreIeltsNotesFocus(ieltsNotesFocus) && !restoreIeltsVoiceFocus(ieltsVoiceFocus)) root.focus({ preventScroll: true });
}

function dirtySettings(patch) {
  const state = store.getState();
  store.setState({ settings: { ...state.settings, ...patch }, saveStatus: "dirty" });
}

function updateSettingsUI(input) {
  const state = store.getState();
  const speed = state.settings.speed;
  const difficulty = state.settings.difficulty;
  const level = CEFR_LEVELS[difficulty - 1];
  const zone = input.closest(".range-zone");
  zone.style.setProperty("--progress", `${input.dataset.setting === "speed" ? (speed-80)/120*100 : (difficulty-1)/5*100}%`);
  zone.querySelectorAll(".range-marks i").forEach((mark,index,marks)=>{
    const activeIndex = input.dataset.setting === "speed" ? (speed-80)/10 : difficulty-1;
    mark.classList.toggle("passed", index <= activeIndex);
    mark.classList.toggle("current", index === activeIndex);
  });
  if (input.dataset.setting === "speed") {
    root.querySelector("[data-speed-label]").textContent = `${SPEED_META[speed][0]} · ${speed} WPM`;
    root.querySelector("[data-speed-detail]").textContent = SPEED_META[speed][1];
    input.setAttribute("aria-valuetext", `${SPEED_META[speed][0]}，${speed} WPM`);
    const center = zone.querySelector(".range-edge b"); if (center) center.textContent = `${speed} · ${SPEED_META[speed][0]}`;
  } else {
    root.querySelector("[data-level-label]").textContent = `${level.code} · ${level.label}`;
    root.querySelector("[data-level-detail]").textContent = level.detail;
    input.setAttribute("aria-valuetext", `CEFR ${level.code}，${level.label}`);
    zone.querySelectorAll(".cefr-labels span").forEach((label,index)=>label.classList.toggle("active",index===difficulty-1));
  }
  root.querySelector("[data-setting-summary]").textContent = `${speed} WPM · CEFR ${level.code}`;
  root.querySelector("[data-save-note]").textContent = "有未保存的修改";
  const save = root.querySelector("[data-action='save-settings']"); save.className = "save-btn ready"; save.setAttribute("aria-disabled","false");
  const sync = root.querySelector(".sync-state"); sync.className = "sync-state is-dirty"; sync.querySelector("span").textContent = "等待保存";
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]");
  
  // Handle special elements without data-action (like the signout button in profile)
  if (!target && event.target.closest(".signout")) {
    store.setState({ user: null });
    showToast("已安全退出登录");
    location.hash = "#/conversation";
    render();
    return;
  }
  
  if (!target) {
    // Fill prompt textarea if clicking samples
    if (event.target.closest(".prompt-samples button")) {
      const val = event.target.textContent;
      const req = document.getElementById("scene-request");
      if (req) req.value = val;
    }
    return;
  }
  
  const action = target.dataset.action;
  const state = store.getState();

  if (action === "ielts-select-mode") {
    voiceAnswerController.reset();
    ieltsController.selectMode(target.dataset.mode, target.dataset.part || null);
    return;
  }
  if (action === "ielts-home") { voiceAnswerController.reset(); ieltsController.openHome(); return; }
  if (action === "ielts-toggle-preflight-captions") {
    const current = ieltsController.getSnapshot().preflight.captionsEnabled;
    ieltsController.setPreflight({ captionsEnabled: !current }); return;
  }
  if (action === "ielts-toggle-recording") {
    const current = ieltsController.getSnapshot().preflight.recordingEnabled;
    ieltsController.setPreflight({ recordingEnabled: !current }); return;
  }
  if (action === "ielts-toggle-accelerated") {
    const current = ieltsController.getSnapshot().preflight.acceleratedDemo;
    ieltsController.setPreflight({ acceleratedDemo: !current }); return;
  }
  if (action === "ielts-start") { voiceAnswerController.reset(); ieltsController.start(); return; }
  if (action === "ielts-toggle-captions") { ieltsController.toggleCaptions(); return; }
  if (action === "ielts-voice-start") { voiceAnswerController.start(); return; }
  if (action === "ielts-voice-pause") { voiceAnswerController.pause(); return; }
  if (action === "ielts-voice-resume") { voiceAnswerController.resume(); return; }
  if (action === "ielts-voice-finish") {
    const transcript = voiceAnswerController.finish();
    ieltsController.submitAnswer(transcript);
    voiceAnswerController.reset();
    return;
  }
  if (action === "ielts-retry") { voiceAnswerController.reset(); ieltsController.retry(); return; }
  if (action === "ielts-next") { voiceAnswerController.reset(); ieltsController.next(); return; }
  if (action === "ielts-exit") {
    if (window.confirm("退出后完整模考将标记为未完成，确定退出吗？")) {
      voiceAnswerController.reset();
      ieltsController.exit();
    }
    return;
  }
  if (action === "ielts-restart") { voiceAnswerController.reset(); ieltsController.restart(); return; }
  
  if (action === "toggle-nav") {
    const open = !state.mobileNavOpen; store.setState({ mobileNavOpen: open });
    target.setAttribute("aria-expanded", String(open)); shell.classList.toggle("mobile-nav-open", open); return;
  }
  if (action === "new-conversation") { endRealtime(); return; }
  if (action === "select-conversation") { if (realtimeClient.isActive()) realtimeClient.stop(); store.setState({ activeConversation: target.dataset.id, voiceState: "ready", realtime: createRealtimeState() }); render(); return; }
  if (action === "toggle-text") { store.setState({ textOpen: !state.textOpen }); render(); return; }
  if (action === "toggle-mic") {
    if (!realtimeClient.isActive()) startRealtime();
    else realtimeClient.setMuted(!state.realtime?.muted);
    return;
  }
  if (action === "toggle-mute") { store.setState({ muted: !state.muted }); render(); return; }
  if (action === "end-conversation") { endRealtime(); showToast("对话已结束，已回到准备状态"); return; }
  if (action === "help-expression") { showToast("可以从 “I’d like…” 或 “Could you…” 开始"); return; }
  if (action === "topic") { startRealtime(target.textContent.trim()); return; }
  if (action === "retry-realtime") { endRealtime().then(() => startRealtime()); return; }
  if (action === "voice-orb") {
    const route = parseRoute(location.hash);
    if (route.name === "training" && route.params.stage === "sentences") {
      const isRecording = !state.recording;
      if (isRecording) {
        store.setState({ recording: true });
        render();
      } else {
        const sentenceIndex = state.activeAsset || 0;
        const attempts = state.attempts || {};
        const currentAttempts = attempts[sentenceIndex] || 0;
        const nextAttempts = currentAttempts + 1;
        attempts[sentenceIndex] = nextAttempts;
        
        const score = nextAttempts === 1 ? 76 : 89;
        const sentenceText = sentences[sentenceIndex].text;
        let highlightedMarkup = "";
        
        if (score < 80) {
          if (sentenceIndex === 0) highlightedMarkup = `Could you <span class="word-error">recommend</span> something less sweet?`;
          else if (sentenceIndex === 1) highlightedMarkup = `I feel <span class="word-error">like trying</span> something different today.`;
          else if (sentenceIndex === 2) highlightedMarkup = `I’ll have a medium <span class="word-error">latte</span> with oat milk.`;
          else highlightedMarkup = `That’s all, <span class="word-error">thank</span> you.`;
        } else {
          highlightedMarkup = `<span class="word-correct">${sentenceText}</span>`;
        }
        
        store.setState({
          recording: false,
          attempts,
          activeEval: {
            score,
            highlightedMarkup
          }
        });
        render();
        showToast(score >= 80 ? "跟读评估完成，成绩达标！" : "发音有微小错误，分数未达标");
      }
      return;
    }
    store.setState({ voiceState: state.voiceState === "listening" ? "ready" : "listening" });
    render();
    return;
  }
  if (action === "close-eval") {
    const sentenceScores = state.sentenceScores || {};
    if (state.activeEval && state.activeEval.score >= 80) {
      sentenceScores[state.activeAsset] = state.activeEval.score;
    }
    store.setState({
      activeEval: null,
      sentenceScores
    });
    render();
    return;
  }
  if (action === "go-to-sentences") {
    store.setState({ activeAsset: 0, recording: false, playingId: "", activeEval: null });
  }
  if (action === "go-to-words") {
    store.setState({ activeAsset: 0, recording: false, playingId: "", activeEval: null });
  }
  if (action === "end-simulation") {
    store.setState({ activeAsset: 0, recording: false, playingId: "", activeEval: null, sentenceScores: {}, showSimulationTips: false });
    location.hash = "#/scenes";
    showToast("已结束模拟，返回场景广场");
    return;
  }
  if (action === "show-simulation-tips") {
    store.setState({ showSimulationTips: true });
    render();
    return;
  }
  if (action === "close-simulation-tips") {
    store.setState({ showSimulationTips: false });
    render();
    return;
  }
  if (action === "play") { store.setState({ playingId: state.playingId === target.dataset.id ? "" : target.dataset.id }); render(); return; }
  
  if (action === "record") {
    const route = parseRoute(location.hash);
    if (route.name === "review-detail") {
      if (state.recording) {
        store.setState({ recording: false, voiceState: "evaluating" });
        render();
        setTimeout(() => {
          const active = learningAssets[store.getState().activeAsset] || learningAssets[0];
          const newRun = {
            id: "h" + (store.getState().pronunciationHistory ? store.getState().pronunciationHistory.length + 1 : 4),
            date: "刚刚",
            item: active.text,
            duration: "00:05",
            result: `发音得分：${Math.floor(Math.random() * 8) + 89}分 · 重音准确，连读更自然！`
          };
          const pHistory = store.getState().pronunciationHistory ? [...store.getState().pronunciationHistory] : [...pronunciationHistory];
          pHistory.unshift(newRun);
          
          const masteryStatus = { ...store.getState().masteryStatus };
          masteryStatus[active.id] = "mastered";
          
          store.setState({
            voiceState: "ready",
            pronunciationHistory: pHistory,
            masteryStatus
          });
          showToast("跟读评估完成！发音水平已提升，自动标为已掌握");
          render();
        }, 1500);
      } else {
        store.setState({ recording: true });
        render();
      }
    } else {
      store.setState({ recording: !state.recording });
      render();
      if (state.recording) showToast("跟读已记录：重音清晰，节奏可以更连贯");
    }
    return;
  }
  
  if (action === "select-asset") { store.setState({ activeAsset: Number(target.dataset.index), recording: false, playingId: "" }); render(); return; }
  if (action === "previous-asset") { store.setState({ activeAsset: Math.max(0, state.activeAsset - 1), recording: false, playingId: "" }); render(); return; }
  if (action === "next-asset") { store.setState({ activeAsset: state.activeAsset + 1, recording: false, playingId: "" }); render(); return; }
  if (action === "toggle-translation") {
    const idx = Number(target.dataset.index);
    const translatedTurns = { ...(state.translatedTurns || {}) };
    translatedTurns[idx] = !translatedTurns[idx];
    store.setState({ translatedTurns });
    render(); return;
  }
  if (action === "review-filter") { store.setState({ reviewFilter: target.dataset.filter }); render(); return; }
  if (action === "theme") { store.setState({ theme: target.dataset.theme, saveStatus: "dirty" }); document.body.dataset.theme = target.dataset.theme; render(); return; }
  if (action === "toggle-setting") { dirtySettings({ [target.dataset.key]: target.getAttribute("aria-pressed") !== "true" }); render(); return; }
  if (action === "save-settings") {
    if (target.getAttribute("aria-disabled") === "true") { showToast("当前设置没有变化"); return; }
    store.setState({ saveStatus: "saving" }); render();
    setTimeout(()=>{ store.setState({ saveStatus: "saved" }); render(); setTimeout(()=>{ store.setState({ saveStatus: "clean" }); render(); },1200); },520); return;
  }
  
  // Auth Page click handlers
  if (action === "auth-switch-tab") {
    store.setState({ authTab: target.dataset.tab });
    render(); return;
  }
  if (action === "get-verify-code") {
    showToast("验证码已发送至您的手机/邮箱！"); return;
  }
  if (action === "oauth-login") {
    const provider = target.dataset.provider === "wechat" ? "微信" : "Apple ID";
    store.setState({ user: { name: "Yufan", email: "yufan@example.com" } });
    showToast(`已使用 ${provider} 成功授权登录！`);
    location.hash = "#/conversation";
    render(); return;
  }

  // Profile page check-in handler
  if (action === "perform-check-in") {
    store.setState({ hasCheckedIn: true });
    showToast("每日打卡成功！已连续坚持 8 天。");
    render(); return;
  }

  // Review Page mastery switch handler
  if (action === "toggle-mastery") {
    const itemId = target.dataset.id;
    const masteryStatus = { ...state.masteryStatus };
    masteryStatus[itemId] = masteryStatus[itemId] === "mastered" ? "learning" : "mastered";
    store.setState({ masteryStatus });
    showToast(masteryStatus[itemId] === "mastered" ? "已标记为“已掌握”，移入熟练词库" : "已重新移入“学习中”");
    render(); return;
  }

  // Membership & Payment handler
  if (action === "subscribe-plan") {
    const plan = target.dataset.plan;
    if (state.membership === plan) {
      showToast("您已是该级别会员，无需重复购买"); return;
    }
    store.setState({ paymentModalOpen: true, selectedPlan: plan, paymentMethod: "wechat" });
    render(); return;
  }
  if (action === "close-payment-modal") {
    store.setState({ paymentModalOpen: false });
    render(); return;
  }
  if (action === "select-payment-method") {
    store.setState({ paymentMethod: target.dataset.method });
    render(); return;
  }
  if (action === "confirm-mock-payment") {
    const plan = state.selectedPlan;
    store.setState({ membership: plan, paymentModalOpen: false });
    showToast(`支付成功！已为您成功开通 ${plan === "premium" ? "专业版" : "雅思特训版"} 尊贵权益`);
    render(); return;
  }

  // Custom scene creation actions
  if (action === "generate-custom-scene") {
    const promptInput = document.getElementById("scene-request");
    const promptVal = promptInput ? promptInput.value.trim() : "";
    if (!promptVal) {
      showToast("请先在输入框描述你想练习的具体场景！");
      return;
    }
    store.setState({
      customSceneConfig: {
        prompt: promptVal,
        difficulty: state.settings.difficulty,
        duration: 6,
        requirements: "要求词汇契合情境"
      }
    });
    location.hash = "#/custom-scene/generating";
    render(); return;
  }
  if (action === "regenerate-custom-scene") {
    location.hash = "#/custom-scene/generating";
    render(); return;
  }
});

document.addEventListener("submit", async (event) => {
  const action = event.target.dataset.action;

  if (action === "ielts-submit-answer") {
    event.preventDefault();
    const value = new FormData(event.target).get("answer")?.toString() || "";
    ieltsController.submitAnswer(value);
    return;
  }
  
  if (action === "send-text") {
    event.preventDefault();
    const value = new FormData(event.target).get("message")?.toString().trim();
    if (!value) return;
    if (!realtimeClient.isActive()) await startRealtime("Use text and voice naturally. Continue in English.");
    if (!realtimeClient.isActive()) return;
    try {
      realtimeClient.sendText(value);
      store.setState({ transcriptDraft:"", textOpen:true, activeConversation:"new" });
      render();
    } catch (error) { showToast(error.message || "文字消息发送失败"); }
    return;
  }
  
  if (action === "submit-login") {
    event.preventDefault();
    const fd = new FormData(event.target);
    const identifier = fd.get("identifier") || "Yufan";
    store.setState({ user: { name: identifier.split("@")[0] || "Yufan", email: identifier } });
    showToast("身份验证成功，欢迎使用 UniSpeaking！");
    location.hash = "#/conversation";
    render();
    return;
  }
});

document.addEventListener("keydown", (event) => {
  const input = event.target;
  if (!input.matches?.("[data-setting]")) return;
  const supported = ["ArrowLeft", "ArrowDown", "ArrowRight", "ArrowUp", "Home", "End"];
  if (!supported.includes(event.key)) return;
  event.preventDefault();
  const min = Number(input.min);
  const max = Number(input.max);
  const step = Number(input.step);
  const value = Number(input.value);
  let next = value;
  if (event.key === "Home") next = min;
  if (event.key === "End") next = max;
  if (event.key === "ArrowLeft" || event.key === "ArrowDown") next = Math.max(min, value - step);
  if (event.key === "ArrowRight" || event.key === "ArrowUp") next = Math.min(max, value + step);
  if (next === value) return;
  input.value = String(next);
  dirtySettings({ [input.dataset.setting]: next });
  updateSettingsUI(input);
});

document.addEventListener("input", (event) => {
  const input = event.target;
  if (input.matches("[data-action='ielts-voice-transcript']")) {
    if (parseRoute(location.hash).name === "ielts") voiceAnswerController.updateTranscript(input.value);
    return;
  }
  if (input.matches("[data-action='ielts-update-notes']")) {
    if (ieltsController.getSnapshot().exam?.status === "part2_preparing") {
      ieltsController.updateNotes(input.value);
    }
    return;
  }
  if (!input.matches("[data-setting]")) return;
  const value = Number(input.value);
  dirtySettings({ [input.dataset.setting]: value });
  updateSettingsUI(input);
});

window.addEventListener("hashchange", () => {
  const route = parseRoute(location.hash);
  if (route.name !== "ielts") voiceAnswerController.reset();
  if (route.name === "training") {
    store.setState({ activeAsset: 0, recording: false, playingId: "" });
  } else {
    store.setState({ recording: false, playingId: "" });
  }
  store.setState({ mobileNavOpen:false });
  render();
});

window.addEventListener("beforeunload", () => voiceAnswerController.dispose());
if (!location.hash) location.hash = "#/conversation"; else {
  const route = parseRoute(location.hash);
  if (route.name === "training") {
    store.setState({ activeAsset: 0 });
  }
  render();
}
