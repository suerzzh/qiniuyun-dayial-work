import { currentExamItem } from "../ielts/exam-state-machine.mjs";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatTime(seconds = 0) {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function errorBanner(snapshot) {
  return snapshot.error ? `<div class="ielts-error" role="alert">${escapeHtml(snapshot.error)}</div>` : "";
}

function renderHome(snapshot) {
  const cards = [
    { part: "part1", eyebrow: "PART 1", title: "Part 1 专项", detail: "熟悉话题快问快答 · 显示练习文字" },
    { part: "part2", eyebrow: "PART 2", title: "Part 2 专项", detail: "完整题卡 · 准备笔记 · 长回答" },
    { part: "part3", eyebrow: "PART 3", title: "Part 3 专项", detail: "关联话题 · 抽象观点 · 深入追问" },
  ];
  return `<section class="ielts-page ielts-home view-enter">
    <header class="ielts-hero">
      <a class="ielts-back-link" href="#/scenes">← 返回场景广场</a>
      <div class="ielts-hero-copy"><p class="eyebrow">PROFESSIONAL TRAINING</p><h1>IELTS Speaking 雅思口语特训</h1><p>用确定性考试流程练习 Part 1、Part 2 和 Part 3。所有核心问题均来自可追踪题库。</p></div>
      <div class="ielts-standard-note"><strong>练习边界</strong><span>反馈参考 IELTS Speaking 四个维度，不是官方成绩。</span></div>
    </header>
    ${errorBanner(snapshot)}
    <div class="ielts-mode-grid">
      ${cards.map((card) => `<button class="ielts-mode-card panel" type="button" data-action="ielts-select-mode" data-mode="practice_part" data-part="${card.part}"><span>${card.eyebrow}</span><h2>${card.title}</h2><p>${card.detail}</p><b>开始专项练习 →</b></button>`).join("")}
      <button class="ielts-mode-card ielts-full-mock panel" type="button" data-action="ielts-select-mode" data-mode="full_mock"><span>FULL MOCK · 11–14 MIN</span><h2>完整模拟考试</h2><p>开场与自我介绍 → Part 1 → Part 2 → Part 3。默认使用真实计时，预检页可临时开启 Demo 加速。</p><b>进入完整模考 →</b></button>
    </div>
  </section>`;
}

function selectionName(selection) {
  if (selection?.mode === "full_mock") return "完整模拟考试";
  return `${String(selection?.selectedPart || "part1").replace("part", "Part ")} 专项练习`;
}

function renderToggle(action, pressed, title, detail) {
  return `<button class="ielts-policy-toggle" type="button" data-action="${action}" aria-pressed="${pressed}"><span><strong>${title}</strong><small>${detail}</small></span><i aria-hidden="true"></i></button>`;
}

function renderPreflight(snapshot) {
  const fullMock = snapshot.selection?.mode === "full_mock";
  return `<section class="ielts-page ielts-preflight view-enter">
    <header class="ielts-stage-head"><button class="ielts-back-link" type="button" data-action="ielts-home">← 重新选择</button><span class="ielts-demo-badge">${fullMock ? "FULL MOCK" : "PART PRACTICE"}</span></header>
    <div class="ielts-preflight-grid">
      <section class="ielts-preflight-main panel"><p class="eyebrow">BEFORE YOU START</p><h1>${selectionName(snapshot.selection)}</h1><p>${fullMock ? "默认使用真实考试计时；如需快速验证完整流程，可在右侧临时开启加速。" : "专项练习使用加速计时，便于重复练习当前 Part。"}</p>
        <ul class="ielts-rule-list">
          <li><b>题目冻结</b><span>开始后不换题，Part 2/3 主题始终关联。</span></li>
          <li><b>Part 2 题卡</b><span>准备和正式回答期间都会完整显示。</span></li>
          <li><b>${fullMock ? "严格模式" : "练习模式"}</b><span>${fullMock ? "开始后不允许暂停、跳题或重试。" : "可重试当前题或结束当前题进入下一题。"}</span></li>
        </ul>
      </section>
      <aside class="ielts-preflight-side panel"><p class="eyebrow">SESSION PREFERENCES</p><h2>会话辅助</h2>
        ${renderToggle("ielts-toggle-preflight-captions", snapshot.preflight?.captionsEnabled, "实时字幕", fullMock ? "完整模考默认隐藏，会话中仍可开启" : "专项练习默认显示")}
        ${renderToggle("ielts-toggle-recording", snapshot.preflight?.recordingEnabled, "保存回答录音", "默认关闭；Demo 只验证用户选择，不上传音频")}
        ${fullMock ? renderToggle("ielts-toggle-accelerated", snapshot.preflight?.acceleratedDemo, "加速完整模考（仅 Demo）", "默认关闭；开启后使用 15/20/10/45/60/75 秒测试配置") : ""}
        <div class="ielts-device-check"><span class="is-ready"></span><p><strong>麦克风模拟检查就绪</strong><small>实际 Realtime 权限将在后续适配器中接入</small></p></div>
        ${errorBanner(snapshot)}
        <button class="primary-btn ielts-start-btn" type="button" data-action="ielts-start" ${snapshot.loading ? "disabled" : ""}>${snapshot.loading ? "正在组卷…" : "确认并开始"}</button>
      </aside>
    </div>
  </section>`;
}

const STATUS_META = {
  opening: ["IELTS", "考官开场"],
  introduction: ["Introduction", "自我介绍"],
  part1_answering: ["Part 1", "快问快答"],
  part2_preparing: ["Part 2", "准备时间"],
  part2_answering: ["Part 2", "长回答"],
  part3_answering: ["Part 3", "深入讨论"],
};

function cueCardMarkup(card) {
  return `<article class="ielts-cue-card" data-cue-card-id="${escapeHtml(card.cardId)}">
    <p class="ielts-cue-label">PART 2 · CUE CARD</p>
    <h2>${escapeHtml(card.topicSentence)}</h2>
    <div class="ielts-cue-body"><strong>You should say:</strong><ul>${card.youShouldSay.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>${card.explain ? `<p>${escapeHtml(card.explain)}</p>` : ""}</div>
  </article>`;
}

function captionsMarkup(snapshot) {
  if (!snapshot.exam.captionsEnabled) return "";
  const recent = (snapshot.captions || []).slice(-4);
  return `<section class="ielts-captions" aria-live="polite"><p class="eyebrow">LIVE CAPTIONS</p>${recent.map((item) => `<div class="${item.role === "candidate" ? "candidate" : "examiner"}"><span>${item.role === "candidate" ? "YOU" : "EXAMINER"}</span><p>${escapeHtml(item.text)}</p></div>`).join("")}</section>`;
}

function questionStage(snapshot, item) {
  const practice = snapshot.exam.mode === "practice_part";
  const opening = snapshot.exam.status === "opening";
  const introduction = snapshot.exam.status === "introduction";
  return `<section class="ielts-listening-stage panel">
    <div class="ielts-examiner-orb" aria-hidden="true"><i></i><span></span></div>
    <p class="eyebrow">AI EXAMINER · SPEAKING</p>
    <h2>${opening ? "考官正在进行开场" : introduction ? "请进行自我介绍" : practice ? "回答当前问题" : "请仔细听考官提问"}</h2>
    ${opening ? "<p>开场结束后会自动开启自我介绍回答。</p>" : introduction ? "<p>请用英语介绍自己，最长一分钟。</p>" : practice ? `<p class="ielts-practice-question" data-current-question>${escapeHtml(item?.renderedText || "")}</p>` : `<p>完整模考不显示独立题卡。如需文字辅助，可开启字幕。</p>`}
  </section>`;
}

function notesMarkup(snapshot) {
  const readonly = snapshot.notesLocked ? " readonly" : "";
  return `<section class="ielts-notes panel"><div><p class="eyebrow">PREPARATION NOTES</p><h3>${snapshot.notesLocked ? "准备笔记 · 已锁定" : "准备笔记 · 可编辑"}</h3></div><textarea data-action="ielts-update-notes" aria-label="Part 2 准备笔记" placeholder="记下关键词，不要写完整句…"${readonly}>${escapeHtml(snapshot.notes || "")}</textarea></section>`;
}

const DEFAULT_VOICE_SNAPSHOT = {
  status: "idle",
  finalTranscript: "",
  interimTranscript: "",
  elapsedSeconds: 0,
  message: "点击麦克风开始回答",
};

function voicePrimaryAction(voice) {
  if (voice.status === "listening") return { action: "ielts-voice-pause", label: "暂停", hint: "正在聆听，点击可暂停" };
  if (voice.status === "paused") return { action: "ielts-voice-resume", label: "继续说话", hint: "继续本轮回答" };
  if (voice.status === "requesting_permission") return { action: "ielts-voice-start", label: "正在开启", hint: "正在请求麦克风权限", disabled: true };
  if (voice.status === "fallback") return { action: "ielts-voice-start", label: "麦克风不可用", hint: "请使用文字回答", disabled: true };
  if (voice.status === "finalizing") return { action: "ielts-voice-start", label: "正在结束", hint: "正在提交本轮回答", disabled: true };
  return { action: "ielts-voice-start", label: "开始说话", hint: "打开麦克风开始回答" };
}

export function voicePresentation(voice = DEFAULT_VOICE_SNAPSHOT) {
  const primary = voicePrimaryAction(voice);
  const statusMessage = voice.message && !(voice.status !== "idle" && voice.message === DEFAULT_VOICE_SNAPSHOT.message)
    ? voice.message
    : primary.hint;
  return {
    ...primary,
    statusMessage,
    elapsedText: formatTime(voice.elapsedSeconds),
    finishDisabled: voice.status === "finalizing",
  };
}

function answerControls(snapshot, voice = DEFAULT_VOICE_SNAPSHOT) {
  if (snapshot.exam.status === "opening") {
    return `<div class="ielts-prep-wait"><span></span><p><strong>考官开场中</strong><small>请听完提示，随后开始自我介绍</small></p></div>`;
  }
  if (snapshot.exam.status === "part2_preparing") {
    return `<div class="ielts-prep-wait"><span></span><p><strong>准备计时进行中</strong><small>倒计时结束后笔记将自动锁定</small></p></div>`;
  }
  const primary = voicePresentation(voice);
  const statusMessage = primary.statusMessage;
  const practiceActions = snapshot.exam.mode === "practice_part"
    ? `<button class="outline-btn" type="button" data-action="ielts-retry">重试当前题</button><button class="outline-btn" type="button" data-action="ielts-next">进入下一题</button>`
    : "";
  const strict = snapshot.exam.mode === "full_mock";
  const rawOnly = strict || Boolean(snapshot.attemptId);
  return `<section class="ielts-voice-panel panel is-${voice.status}" aria-label="语音回答">
    <header><div><p class="eyebrow">YOUR ANSWER</p><h3>用英语回答当前问题</h3></div><time>${primary.elapsedText}</time></header>
    <div class="ielts-voice-stage">
      <button class="ielts-mic-button is-${voice.status}" type="button" data-action="${primary.action}" aria-label="${primary.hint}"${primary.disabled ? " disabled" : ""}><span aria-hidden="true"></span><b>${primary.label}</b></button>
      <div class="ielts-waveform" aria-hidden="true">${"<i></i>".repeat(5)}</div>
      <p class="ielts-voice-status" aria-live="polite">${escapeHtml(statusMessage)}</p>
    </div>
    <label class="ielts-transcript" for="ielts-voice-transcript"><span>${rawOnly ? "Qwen Realtime 原始转写 · 评分输入只读" : "实时转写"}</span><textarea id="ielts-voice-transcript" data-action="ielts-voice-transcript" placeholder="开始说话后，转写会显示在这里…"${rawOnly ? " readonly" : ""}>${escapeHtml(voice.finalTranscript || "")}</textarea>${voice.interimTranscript ? `<small>${escapeHtml(voice.interimTranscript)}</small>` : ""}</label>
    <footer>${practiceActions}<button class="primary-btn" type="button" data-action="ielts-voice-finish"${primary.finishDisabled ? " disabled" : ""}>结束本轮回答</button></footer>
  </section>`;
}

function renderSession(snapshot, voiceSnapshot) {
  const meta = STATUS_META[snapshot.exam.status] || ["IELTS", "Speaking"];
  const item = currentExamItem(snapshot.exam);
  const isPart2 = snapshot.exam.currentPart === "part2";
  const timer = snapshot.timer ? formatTime(snapshot.timer.remainingSeconds) : "LIVE";
  const timingLabel = snapshot.paper.timingProfile === "accelerated_demo" ? "DEMO 加速模式" : "真实考试计时";
  const part3Timing = snapshot.part3Timer ? `<div class="ielts-part3-timing"><strong>Part 3 总计时 ${formatTime(snapshot.part3Timer.elapsedSeconds)}</strong><span>软结束 ${formatTime(snapshot.part3Timer.softLimitSeconds)} · 硬结束 ${formatTime(snapshot.part3Timer.hardLimitSeconds)}</span></div>` : "";
  return `<section class="ielts-page ielts-session" data-exam-status="${escapeHtml(snapshot.exam.status)}">
    <header class="ielts-session-head">
      <div><span class="ielts-demo-badge">${timingLabel}</span><p><strong>${meta[0]}</strong><small>${meta[1]}</small></p>${part3Timing}</div>
      <div class="ielts-session-tools"><time>${timer}</time><button type="button" data-action="ielts-toggle-captions" aria-pressed="${snapshot.exam.captionsEnabled}">字幕 ${snapshot.exam.captionsEnabled ? "开" : "关"}</button><button type="button" data-action="ielts-exit">退出</button></div>
    </header>
    ${errorBanner(snapshot)}
    <main class="ielts-exam-desk ${isPart2 ? "is-part2" : "is-dialogue"}">
      ${isPart2 ? cueCardMarkup(snapshot.paper.parts.part2) : questionStage(snapshot, item)}
      ${captionsMarkup(snapshot)}
      ${isPart2 ? notesMarkup(snapshot) : ""}
      ${answerControls(snapshot, voiceSnapshot)}
    </main>
  </section>`;
}

function renderReport(snapshot) {
  if (snapshot.exam?.status === "abandoned") {
    return `<section class="ielts-page ielts-report view-enter"><div class="ielts-report-hero panel"><p class="eyebrow">SESSION ENDED</p><h1>本次模考未完成</h1><p>已保留完成的 Demo 记录，不生成代表整场表现的结论。</p><button class="primary-btn" type="button" data-action="ielts-restart">返回 IELTS 首页</button></div></section>`;
  }
  const report = snapshot.report;
  const status = report?.scoringStatus || report?.scoring_status || snapshot.scoringStatus;
  if (status === "FINALIZING" || status === "SCORING") {
    return `<section class="ielts-page ielts-report view-enter"><div class="ielts-report-hero panel"><p class="eyebrow">SCORING IN PROGRESS</p><h1>正在生成考后报告</h1><p>考试已经结束。四项证据将在后台完成后一次性显示，过程中不会展示逐轮分数、纠错或建议表达。</p></div></section>`;
  }
  const fallbackDimensions = report?.dimensions || {};
  const dimensions = [
    ["流利度与连贯性（FC）", report?.fc || fallbackDimensions.fluencyCoherence],
    ["词汇资源（LR）", report?.lr || fallbackDimensions.lexicalResource],
    ["语法多样性与准确性（GRA）", report?.gra || fallbackDimensions.grammaticalRangeAccuracy],
    ["发音（Pronunciation）", report?.pronunciation || fallbackDimensions.pronunciation],
  ].map(([label, value]) => ({
    label,
    status: "not_assessed",
    unavailableReason: "暂无可用证据",
    ...(value || {}),
  }));
  const overall = report?.overallBand ?? report?.overall_band;
  const range = report?.bandRange || report?.band_range || [];
  const warnings = report?.dataQualityWarnings || report?.data_quality_warnings || [];
  return `<section class="ielts-page ielts-report view-enter">
    <header class="ielts-report-hero"><p class="eyebrow">AI 训练反馈 · ${escapeHtml(status || "PARTIAL")}</p><h1>${overall == null ? "AI 练习反馈 · 未生成完整 Overall" : `Overall ${escapeHtml(overall)}`}</h1><p>${escapeHtml(report?.disclaimer || "")}</p><div><span>预估区间 ${range.length ? escapeHtml(range.join("–")) : "暂无"}</span><span>置信度 ${report?.confidence == null ? "暂无" : escapeHtml(Math.round(report.confidence * 100) + "%")}</span></div></header>
    <div class="ielts-dimension-grid">${dimensions.map((dimension) => `<article class="ielts-dimension-card panel ${dimension.band == null || dimension.status === "not_assessed" ? "is-muted" : ""}"><div><span>${dimension.band == null ? "不可用" : `Band ${escapeHtml(dimension.band)}`}</span><h2>${escapeHtml(dimension.label)}</h2></div><dl><dt>优势证据</dt><dd>${escapeHtml((dimension.positiveEvidence || dimension.positive_evidence || [dimension.strength]).filter(Boolean).join("；") || dimension.evidence || "暂无可用证据")}</dd><dt>限制因素</dt><dd>${escapeHtml((dimension.limitingEvidence || dimension.limiting_evidence || [dimension.nextStep]).filter(Boolean).join("；") || dimension.unavailableReason || "暂无可用证据")}</dd></dl></article>`).join("")}</div>
    ${warnings.length ? `<section class="panel"><h2>数据质量提示</h2><ul>${warnings.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>` : ""}
    ${report?.partSummaries ? `<section class="panel"><h2>各 Part 表现摘要</h2>${Object.entries(report.partSummaries).map(([part, value]) => `<p><strong>${escapeHtml(part)}</strong> ${escapeHtml(value)}</p>`).join("")}</section>` : ""}
    <footer class="ielts-report-actions"><a class="outline-btn" href="#/scenes">返回场景广场</a><button class="primary-btn" type="button" data-action="ielts-restart">再练一次</button></footer>
  </section>`;
}

export function renderIelts(snapshot = {}, voiceSnapshot = DEFAULT_VOICE_SNAPSHOT) {
  if (snapshot.screen === "preflight") return renderPreflight(snapshot);
  if (snapshot.screen === "session") return renderSession(snapshot, voiceSnapshot);
  if (snapshot.screen === "report") return renderReport(snapshot);
  return renderHome(snapshot);
}
