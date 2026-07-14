import { icon, stageProgress, voiceOrb } from "../components.mjs";
import { diagnosticDimensions, learningAssets, sentences } from "../data.mjs";

const trainingHeader = (stage, title, description) => `<header class="training-head">
  <div><p class="eyebrow">CAFE ORDERING · 约 6 分钟</p><h1>${title}</h1><p>${description}</p></div>
  <a class="outline-btn exit-training-btn" href="#/scenes">退出训练</a>
</header>${stageProgress(stage)}`;

function renderWords(state) {
  const index = Math.min(state.activeAsset || 0, learningAssets.length - 1);
  const active = learningAssets[index];
  return `${trainingHeader("words", "场景词语", "先熟悉高频表达，再进入完整句子。")}
    <div class="learning-layout">
      <aside class="asset-queue panel"><div class="queue-head"><span>本节表达</span><span>${index + 1} / ${learningAssets.length}</span></div>
        ${learningAssets.map((item, itemIndex) => `<button class="queue-item ${itemIndex === index ? "active" : ""}" type="button" data-action="select-asset" data-index="${itemIndex}"><span>${item.type}</span><strong>${item.text}</strong><i>${itemIndex < index ? icon("check") : itemIndex + 1}</i></button>`).join("")}
      </aside>
      <section class="learning-card panel">
        <div class="learning-type"><span>${active.type}</span><small>${active.note}</small></div>
        <div class="learning-copy"><h2>${active.text}</h2><p class="phonetic">${active.phonetic}</p><p class="translation">${active.translation}</p></div>
        <div class="audio-line"><button class="audio-circle ${state.playingId === active.id ? "active" : ""}" type="button" data-action="play" data-id="${active.id}" aria-label="播放示范音">${icon(state.playingId === active.id ? "pause" : "play")}</button><span><strong>标准示范</strong><small>自然语速 · 点击播放</small></span><div class="wave-mini" aria-hidden="true">${"<i></i>".repeat(16)}</div></div>
        <div class="shadow-zone">${voiceOrb(state.recording ? "listening" : "ready", "开始跟读")}<div><p class="eyebrow">SHADOWING</p><h3>${state.recording ? "正在聆听你的跟读" : "跟读并模仿重音"}</h3><p>完成后可继续下一条表达。</p></div><button class="primary-btn" type="button" data-action="next-asset">下一条</button></div>
        <div class="learning-foot"><button class="outline-btn" type="button" data-action="previous-asset">上一条</button><a class="primary-btn" href="#/training/cafe/sentences" data-action="go-to-sentences">进入句子训练 ${icon("arrow")}</a></div>
      </section>
    </div>`;
}

function renderSentences(state) {
  const index = Math.min(state.activeAsset || 0, sentences.length - 1);
  const active = sentences[index];
  return `${trainingHeader("sentences", "整句跟读", "听清节奏与连读，用完整句子表达需求。")}
    <section class="sentence-shell panel">
      <aside class="sentence-list"><p class="eyebrow">本节句子</p>${sentences.map((item, itemIndex) => `<button class="${itemIndex === index ? "active" : ""}" type="button" data-action="select-asset" data-index="${itemIndex}"><span>0${itemIndex + 1}</span><p>${item.text}</p></button>`).join("")}</aside>
      <div class="sentence-stage"><span class="sentence-index">${index + 1} / ${sentences.length}</span><button class="listen-pill" type="button" data-action="play" data-id="sentence-${index}">${icon("volume")} 听标准示范</button><h2>${active.text}</h2><p class="sentence-cn">${active.translation}</p><div class="rhythm-guide"><span>节奏提示</span><strong>${active.focus}</strong></div>
        <div class="sentence-record">${voiceOrb(state.recording ? "listening" : "ready", "开始整句跟读")}<div><h3>${state.recording ? "录音中，再次点击完成" : "按住自然说完整句"}</h3><p>系统会标出需要调整的重音与连读。</p></div><button class="primary-btn" type="button" data-action="next-asset">下一句</button></div>
        <div class="learning-foot"><a class="outline-btn" href="#/training/cafe/words" data-action="go-to-words">返回词语</a><a class="primary-btn" href="#/training/cafe/simulation">进入情景模拟 ${icon("arrow")}</a></div>
      </div>
    </section>`;
}

function renderSimulation(state) {
  return `${trainingHeader("simulation", "情景模拟", "把刚刚练习的表达用进一段真实交流。")}
    <section class="simulation-shell panel"><aside class="simulation-brief"><p class="eyebrow">你的任务</p><h2>在咖啡店完成点单</h2><ul><li>询问低糖推荐</li><li>选择中杯拿铁</li><li>将牛奶换成燕麦奶</li><li>礼貌确认订单</li></ul><div class="simulation-rule">${icon("help")}<p><strong>咖啡店店员</strong><br><small>AI 会根据你的回答自然追问。</small></p></div></aside>
      <div class="simulation-stage"><div class="simulation-transcript"><div class="turn"><span>AI · 咖啡店店员</span><p>Hi! What can I get started for you today?</p></div><div class="turn you"><span>YOU</span><p>Could you recommend something less sweet?</p></div><div class="turn live"><span>AI</span><p>Of course. Would you like to try our latte with oat milk?</p></div></div>
        <div class="simulation-voice">${voiceOrb(state.voiceState || "ready", "回应店员")}<div><strong>轮到你回应</strong><span>自然说出选择，也可以先查看表达提示。</span></div></div>
        <div class="simulation-actions"><button class="outline-btn" type="button" data-action="show-simulation-tips">表达提示</button><button class="outline-btn" type="button" data-action="end-simulation">结束训练</button><a class="primary-btn" href="#/training/cafe/diagnostic">完成并查看诊断 ${icon("arrow")}</a></div>
      </div></section>`;
}

function renderDiagnostic() {
  return `${trainingHeader("diagnostic", "训练诊断", "根据本次词句跟读与情景对话生成的能力反馈。")}
    <div class="diagnostic-layout"><section class="diagnostic-main panel"><div class="diagnostic-summary"><div><p class="eyebrow">综合表现</p><strong>84<small>/100</small></strong></div><div><h2>表达完整，互动自然</h2><p>你能清楚说明偏好并接住追问，下一步重点优化连读节奏。</p></div></div><div class="dimension-grid">${diagnosticDimensions.map((item) => `<article><div><span>${item.name}</span><strong>${item.value}</strong></div><div class="score-rail"><i style="--score:${item.value}%"></i></div><p>${item.note}</p></article>`).join("")}</div></section>
      <aside class="diagnostic-side"><section class="next-focus panel"><p class="eyebrow">NEXT FOCUS</p><h2>推荐下一步</h2><p>继续练习 recommend 的末音节重音，以及 with oat milk 的自然连接。</p><a class="primary-btn" href="#/review/cafe">进入针对性复习</a></section><section class="recent-check panel"><p class="eyebrow">本次亮点</p><h2>已掌握表达</h2>${learningAssets.map((item) => `<button type="button"><span>${icon("check")}</span><p>${item.text}<small>${item.translation}</small></p></button>`).join("")}</section></aside></div>
    <footer class="diagnostic-foot"><p>诊断结果会保存到个人学习记录。</p><div><a class="outline-btn" href="#/scenes">返回场景</a><a class="primary-btn" href="#/conversation">进入自由对话 ${icon("arrow")}</a></div></footer>`;
}

export function renderTraining(stage, state = {}) {
  const safeStage = ["words", "sentences", "simulation", "diagnostic"].includes(stage) ? stage : "words";
  const content = safeStage === "words" ? renderWords(state) : safeStage === "sentences" ? renderSentences(state) : safeStage === "simulation" ? renderSimulation(state) : renderDiagnostic();
  return `<section class="training-page view-enter">${content}</section>`;
}
