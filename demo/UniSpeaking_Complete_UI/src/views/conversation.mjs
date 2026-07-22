import { conversations } from "../data.mjs";
import { escapeHTML, icon } from "../components.mjs";

export function renderConversation(state) {
  const active = conversations.find((item) => item.id === state.activeConversation) || conversations[0];
  const realtime = state.realtime || { status: "idle", messages: [], muted: false, error: null };
  const isRealtime = state.activeConversation === "new" && realtime.status !== "idle" && realtime.status !== "ended";
  const turns = isRealtime
    ? realtime.messages.map((message) => [message.role === "user" ? "You" : "AI", message.text])
    : active?.turns || [];
  const ready = state.activeConversation === "new" && !isRealtime;
  const translatedTurns = state.translatedTurns || {};

  // Preset translation mapping for local prototype
  const TRANSLATIONS = {
    "Could you recommend something less sweet?": "你能推荐一些不太甜的吗？",
    "I feel like trying something different today.": "我今天想尝尝不一样的东西。",
    "latte with oat milk": "加燕麦奶的拿铁",
    "Would you like me to recommend something?": "需要我为您推荐一些东西吗？",
    "I’ll have a medium latte with oat milk.": "我要一杯中杯燕麦奶拿铁。",
    "That’s all, thank you.": "就这些，谢谢。",
    "Hey, hello!": "嘿，你好！",
    "Hi there! How can I help you today?": "嗨！今天有什么可以帮您的吗？",
    "Could you recommend me something less sweet?": "你能推荐一些不太甜的吗？",
    "How was lunch with your classmates today?": "今天和同学的午餐怎么样？",
    "It was relaxing. We talked about our group project and the food near campus.": "挺轻松的。我们聊了聊小组项目，还有校区附近的美食。",
    "That sounds nice. Which part of the project are you taking care of?": "听起来真不错。你负责项目的哪一部分呢？",
    "I watched a documentary about ocean exploration.": "我看了部关于海洋探索的纪录片。",
    "What surprised you most about it?": "关于它，最让你感到惊喜的是什么？",
    "Do you have anything planned for this weekend?": "你这周末有什么计划吗？",
    "I might visit a small exhibition downtown.": "我可能会去市中心看个小展览。"
  };

  const modeClass = state.textOpen ? "text-mode" : "voice-mode";
  const visualVoiceState = ["connecting", "configuring", "connected", "listening", "ai_speaking"].includes(realtime.status) ? "listening" : state.voiceState;
  const statusCopy = {
    connecting: "正在连接实时口语助手…",
    configuring: "正在载入你的口语教练…",
    connected: "实时连接正常，Clara 准备开场",
    listening: "实时连接正常，你可以开始说话",
    ai_speaking: "Clara 正在回应，请继续聆听",
    error: realtime.error || "连接失败，请重新开始",
  }[realtime.status] || (ready ? "点击麦克风开始实时对话" : "随时接着说");

  return `<section class="conversation-view doubao-theme brand-style ${modeClass} view-enter">
    
    <!-- Subtitles/Chat Bubbles Area (Slides in when textOpen is true) -->
    <div class="chat-bubbles-container">
      ${realtime.status === "error" ? `
        <div class="chat-bubbles-ready-state"><div class="ready-content realtime-error"><p class="eyebrow">CONNECTION ERROR</p><h2>暂时无法开始对话</h2><p>${escapeHTML(realtime.error || "实时服务暂不可用")}</p><button class="primary-btn" type="button" data-action="retry-realtime">重新开始</button></div></div>
      ` : ready ? `
        <div class="chat-bubbles-ready-state">
          <div class="ready-content">
            <p class="eyebrow">Today's Topic</p>
            <h2>开启闲聊练习</h2>
            <p>Clara 随时准备着，说点什么或者点击下方话题开始吧</p>
            <div class="quick-topics">
              <button type="button" data-action="topic">今天最放松的时刻</button>
              <button type="button" data-action="topic">最近一次小惊喜</button>
            </div>
          </div>
        </div>
      ` : `
        <div class="chat-bubbles-list" data-realtime-status="${realtime.status}">
          ${isRealtime && turns.length === 0 ? `<div class="realtime-connecting-note"><span></span><p>${escapeHTML(statusCopy)}</p></div>` : ""}
          ${turns.map(([speaker, text], index) => {
            const isYou = speaker === "You";
            const isTranslated = translatedTurns[index];
            const translation = TRANSLATIONS[text] || `(已翻译：${text})`;
            return `
              <article class="chat-bubble-row ${isYou ? "you" : "ai"}">
                <div class="bubble-avatar">${isYou ? "Me" : "C"}</div>
                <div class="bubble-content-box">
                  <div class="bubble-text">
                    <p>${escapeHTML(text)}</p>
                    ${isTranslated ? `<p class="bubble-translation-text">${escapeHTML(translation)}</p>` : ""}
                  </div>
                  ${!isYou ? `
                    <div class="bubble-actions">
                      <button type="button" class="action-btn translation-toggle ${isTranslated ? "active" : ""}" data-action="toggle-translation" data-index="${index}">
                        ${icon("help")} <span>${isTranslated ? "收起" : "翻译"}</span>
                      </button>
                    </div>
                  ` : ""}
                </div>
              </article>
            `;
          }).join("")}
        </div>
      `}
    </div>

    <!-- The Red Circular Voice Orb (Clicks toggle textOpen/subtitles) -->
    <div class="glowing-orb-wrapper">
      <div class="orb-pulsing-glow ${visualVoiceState === "listening" ? "active" : ""}"></div>
      <button class="voice-orb is-${visualVoiceState}" type="button" data-action="toggle-text" aria-label="显示字幕">
        <span class="orb-core"></span>
        <span class="orb-ring ring-a"></span>
        <span class="orb-ring ring-b"></span>
        <span class="orb-bars" aria-hidden="true">
          <i></i><i></i><i></i><i></i><i></i><i></i><i></i>
        </span>
      </button>
    </div>

    <!-- Status Text (Only visible in voice-mode) -->
    <div class="doubao-status">
      <div class="voice-indicators ${visualVoiceState === "listening" ? "animating" : ""}">
        <span></span><span></span><span></span>
      </div>
      <p class="status-desc">
        ${escapeHTML(statusCopy)}
      </p>
      <span class="muted-badge ${realtime.muted || state.muted ? "visible" : ""}">麦克风静音中</span>
    </div>

    <!-- Bottom Composer Bar (Always fixed, identical structure in both modes) -->
    <div class="bottom-composer-wrapper">
      <div class="capsule-composer">
        <!-- Clicking this also toggles subtitles -->
        <button class="chat-toggle-btn ${state.textOpen ? "active" : ""}" type="button" data-action="toggle-text" aria-label="切换文字显示">
          ${icon("chat")}
        </button>
        <form class="chat-input-form" data-action="send-text" style="flex: 1; display: flex; margin: 0; background: transparent; height: auto; padding: 0;">
          <input class="composer-input" name="message" value="${escapeHTML(state.transcriptDraft)}" placeholder="输入你想说话..." autocomplete="off">
          <button type="submit" class="send-message-btn">${icon("arrow")}</button>
        </form>
      </div>

      <!-- Action Buttons (Mic controls mic toggle, X controls end conversation) -->
      <button class="action-btn-circle mic-toggle-btn is-${visualVoiceState}" type="button" data-action="toggle-mic" aria-label="${isRealtime ? "静音或打开麦克风" : "开始实时对话"}">
        ${icon("mic")}
      </button>
      <button class="action-btn-circle end-session-btn" type="button" data-action="end-conversation" aria-label="结束对话">
        <span class="close-cross"></span>
      </button>
    </div>

    <div class="ai-footnote">内容由 AI 模拟生成</div>
  </section>`;
}
