import React, { useEffect, useRef, useState } from "react";
import Icon from "../components/Icon";
import { useRealtimeSession } from "../hooks/useRealtimeSession";
import { isNearScrollBottom } from "../realtime/subtitle-scroll.mjs";

const ACTIVE_STATUSES = new Set([
  "connected",
  "user_speaking",
  "ai_thinking",
  "ai_speaking",
  "interrupted",
  "paused",
]);

const ANIMATED_STATUSES = new Set([
  "requesting_microphone",
  "connecting",
  "user_speaking",
  "ai_thinking",
  "ai_speaking",
  "interrupted",
]);

function visualVoiceState(status) {
  if (status === "user_speaking" || status === "interrupted") return "listening";
  if (status === "ai_speaking") return "speaking";
  if (status === "requesting_microphone" || status === "connecting" || status === "ai_thinking") {
    return "connecting";
  }
  return status;
}

export default function ConversationView({ state, updateState }) {
  const [inputText, setInputText] = useState("");
  const subtitleContainerRef = useRef(null);
  const shouldFollowSubtitlesRef = useRef(true);
  const autoScrollingRef = useRef(false);
  const autoScrollTimerRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));
  const {
    state: session,
    statusText,
    canRetry,
    start,
    retry,
    togglePause,
    toggleMute,
    sendText,
    end,
  } = useRealtimeSession();

  const translatedTurns = state.translatedTurns || {};
  const ready = session.messages.length === 0;
  const active = ACTIVE_STATUSES.has(session.status);
  const busy = session.status === "requesting_microphone" || session.status === "connecting";
  const orbState = visualVoiceState(session.status);
  const modeClass = state.textOpen ? "text-mode" : "voice-mode";
  const subtitleProgressKey = session.messages
    .map((message) => `${message.id}:${message.text.length}:${Number(message.final)}`)
    .join("|");

  useEffect(() => {
    const container = subtitleContainerRef.current;
    if (!container || !state.textOpen || !shouldFollowSubtitlesRef.current) return undefined;

    autoScrollingRef.current = true;
    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth",
    });

    if (autoScrollTimerRef.current) clearTimeout(autoScrollTimerRef.current);
    autoScrollTimerRef.current = setTimeout(() => {
      autoScrollingRef.current = false;
      shouldFollowSubtitlesRef.current = isNearScrollBottom(container);
      autoScrollTimerRef.current = null;
    }, 350);

    return () => {
      if (autoScrollTimerRef.current) clearTimeout(autoScrollTimerRef.current);
      autoScrollTimerRef.current = null;
      autoScrollingRef.current = false;
    };
  }, [state.textOpen, subtitleProgressKey]);

  const handleSubtitleScroll = (event) => {
    if (autoScrollingRef.current) return;
    shouldFollowSubtitlesRef.current = isNearScrollBottom(event.currentTarget);
  };

  const handleManualScrollIntent = () => {
    if (autoScrollTimerRef.current) clearTimeout(autoScrollTimerRef.current);
    autoScrollTimerRef.current = null;
    autoScrollingRef.current = false;
    shouldFollowSubtitlesRef.current = false;
  };

  const handleToggleTextMode = () => {
    if (!state.textOpen) shouldFollowSubtitlesRef.current = true;
    updateState({ textOpen: !state.textOpen });
  };

  const handleToggleTranslation = (messageId) => {
    updateState({
      translatedTurns: {
        ...translatedTurns,
        [messageId]: !translatedTurns[messageId],
      },
    });
  };

  const handlePrimaryAction = () => {
    if (canRetry) {
      void retry();
    } else if (session.status === "idle" || session.status === "ended") {
      void start();
    } else if (active) {
      void togglePause();
    }
  };

  const handleSubmitMessage = async (event) => {
    event.preventDefault();
    const value = inputText.trim();
    if (!value || !active || session.paused) return;
    if (await sendText(value)) setInputText("");
  };

  return (
    <section className={`conversation-view doubao-theme brand-style ${modeClass} view-enter`}>
      <div
        ref={subtitleContainerRef}
        className="chat-bubbles-container"
        aria-live="polite"
        onScroll={handleSubtitleScroll}
        onWheel={handleManualScrollIntent}
        onTouchMove={handleManualScrollIntent}
      >
        {ready ? (
          <div className="chat-bubbles-ready-state">
            <div className="ready-content">
              <p className="eyebrow">Free Conversation</p>
              <h2>开启闲聊练习</h2>
              <p>点击语音球，允许麦克风权限后即可开始真实对话</p>
            </div>
          </div>
        ) : (
          <div className="chat-bubbles-list">
            {session.messages.map((message) => {
              const isYou = message.role === "user";
              const isTranslated = translatedTurns[message.id];
              return (
                <article
                  key={message.id}
                  className={`chat-bubble-row ${isYou ? "you" : "ai"} ${message.final ? "" : "partial"}`}
                >
                  <div className="bubble-avatar">{isYou ? "Me" : "AI"}</div>
                  <div className="bubble-content-box">
                    <div className="bubble-text">
                      <p>{message.text}</p>
                      {isTranslated && (
                        <p className="bubble-translation-text">实时翻译将在后续版本接入</p>
                      )}
                    </div>
                    {!isYou && message.final && (
                      <div className="bubble-actions">
                        <button
                          type="button"
                          className={`action-btn translation-toggle ${isTranslated ? "active" : ""}`}
                          onClick={() => handleToggleTranslation(message.id)}
                        >
                          <Icon name="help" /> <span>{isTranslated ? "收起" : "翻译"}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {session.error && (
        <div className="session-alert" role="alert">
          <span>{session.error}</span>
          {canRetry && (
            <button type="button" className="session-retry-btn" onClick={() => void retry()}>
              重试连接
            </button>
          )}
        </div>
      )}

      <div className="glowing-orb-wrapper">
        <div className={`orb-pulsing-glow ${ANIMATED_STATUSES.has(session.status) ? "active" : ""}`} />
        <button
          className={`voice-orb is-${orbState}`}
          type="button"
          onClick={handlePrimaryAction}
          disabled={busy}
          aria-label={session.paused ? "恢复对话" : active ? "暂停对话" : canRetry ? "重试连接" : "开始对话"}
        >
          <span className="orb-core" />
          <span className="orb-ring ring-a" />
          <span className="orb-ring ring-b" />
          <span className="orb-bars" aria-hidden="true">
            <i /><i /><i /><i /><i /><i /><i />
          </span>
        </button>
      </div>

      <div className="doubao-status">
        <div className={`voice-indicators ${ANIMATED_STATUSES.has(session.status) ? "animating" : ""}`}>
          <span /><span /><span />
        </div>
        <p className="status-desc">{statusText}</p>
        <span className={`muted-badge ${session.muted ? "visible" : ""}`}>麦克风静音中</span>
      </div>

      <div className="bottom-composer-wrapper">
        <div className="capsule-composer">
          <button
            className={`chat-toggle-btn ${state.textOpen ? "active" : ""}`}
            type="button"
            onClick={handleToggleTextMode}
            aria-label="切换文字显示"
          >
            <Icon name="chat" />
          </button>
          <form className="chat-input-form realtime-text-form" onSubmit={handleSubmitMessage}>
            <input
              className="composer-input"
              name="message"
              value={inputText}
              onChange={(event) => setInputText(event.target.value)}
              placeholder="输入你想说的话..."
              autoComplete="off"
              disabled={!active || session.paused}
            />
            <button type="submit" className="send-message-btn" disabled={!active || session.paused}>
              <Icon name="arrow" />
            </button>
          </form>
        </div>

        <button
          className={`action-btn-circle mic-toggle-btn ${session.muted ? "is-muted" : ""}`}
          type="button"
          onClick={toggleMute}
          disabled={!active}
          aria-label={session.muted ? "打开麦克风" : "静音麦克风"}
        >
          <Icon name="mic" />
        </button>
        <button
          className="action-btn-circle end-session-btn"
          type="button"
          onClick={() => void end()}
          disabled={!active && !busy}
          aria-label="结束对话"
        >
          <span className="close-cross" />
        </button>
      </div>

      <div className="ai-footnote">内容由 AI 生成，请注意核验</div>
    </section>
  );
}
