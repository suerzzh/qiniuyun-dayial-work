import React, { useEffect, useRef, useState } from "react";
import VoiceOrb from "../components/VoiceOrb";
import { useRealtimeSession } from "../hooks/useRealtimeSession";

const ACTIVE_STATUSES = new Set([
  "connected",
  "user_speaking",
  "ai_thinking",
  "ai_speaking",
  "interrupted",
  "paused",
]);

function voiceState(status) {
  if (status === "user_speaking" || status === "interrupted") return "listening";
  if (status === "ai_speaking") return "speaking";
  if (["requesting_microphone", "connecting", "ai_thinking"].includes(status)) return "connecting";
  if (["error", "disconnected"].includes(status)) return "error";
  return status === "paused" ? "paused" : "ready";
}

export default function RestaurantSimulationSession() {
  const [showTips, setShowTips] = useState(false);
  const startedRef = useRef(false);
  const transcriptRef = useRef(null);
  const {
    state: session,
    statusText,
    canRetry,
    start,
    retry,
    togglePause,
    toggleMute,
    end,
  } = useRealtimeSession({ scenarioId: "child-restaurant-ordering" });

  const active = ACTIVE_STATUSES.has(session.status);
  const busy = ["requesting_microphone", "connecting"].includes(session.status);
  const transcriptProgress = session.messages
    .map((message) => `${message.id}:${message.text.length}:${Number(message.final)}`)
    .join("|");

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void start();
  }, [start]);

  useEffect(() => {
    const transcript = transcriptRef.current;
    if (!transcript) return;
    transcript.scrollTo({ top: transcript.scrollHeight, behavior: "smooth" });
  }, [transcriptProgress]);

  const handleVoiceAction = () => {
    if (canRetry) {
      void retry();
    } else if (session.status === "idle" || session.status === "ended") {
      void start();
    } else if (active) {
      void togglePause();
    }
  };

  const handleEnd = async () => {
    await end();
    window.location.hash = "#/scenes";
  };

  return (
    <section className="simulation-shell is-full restaurant-simulation panel">
      <div className="simulation-stage">
        <div className="simulation-transcript restaurant-live-transcript" ref={transcriptRef} aria-live="polite">
          {session.messages.length === 0 ? (
            <div className="restaurant-session-intro">
              <p className="eyebrow">Clara&apos;s Restaurant</p>
              <h2>{session.status === "error" ? "暂时没有连接成功" : "Clara 正在准备今天的菜单…"}</h2>
              <p>允许麦克风权限后，Clara 会先用简单英语欢迎你。</p>
            </div>
          ) : (
            session.messages.map((message) => (
              <article key={message.id} className={`turn ${message.role === "user" ? "you" : ""} ${message.final ? "" : "live"}`}>
                <span>{message.role === "user" ? "You" : "Clara 店员"}</span>
                <p>{message.text}</p>
              </article>
            ))
          )}
        </div>

        {session.error && (
          <div className="session-alert restaurant-session-alert" role="alert">
            <span>{session.error}</span>
            {canRetry && <button type="button" onClick={() => void retry()}>重试连接</button>}
          </div>
        )}

        <div className="simulation-voice is-centered restaurant-voice-control">
          <VoiceOrb
            state={voiceState(session.status)}
            label={busy ? "正在连接餐厅对话" : session.paused ? "恢复餐厅对话" : active ? "暂停餐厅对话" : canRetry ? "重试连接" : "开始餐厅对话"}
            onClick={handleVoiceAction}
          />
          <div>
            <strong>{statusText}</strong>
            <span>{session.paused ? "点击语音球继续练习。" : "你是小顾客，Clara 是餐厅服务员。"}</span>
          </div>
        </div>

        <div className="simulation-actions restaurant-simulation-actions">
          <button className="outline-btn" type="button" onClick={() => setShowTips(true)}>需要提示</button>
          <button className="outline-btn" type="button" onClick={toggleMute} disabled={!active}>
            {session.muted ? "打开麦克风" : "麦克风静音"}
          </button>
          <button className="primary-btn" type="button" onClick={() => void handleEnd()} disabled={!active && !busy}>
            结束模拟
          </button>
        </div>
      </div>

      {showTips && (
        <div className="eval-overlay" role="dialog" aria-modal="true" aria-labelledby="restaurant-tip-title">
          <div className="eval-card simulation-tip-card panel">
            <div className="eval-header">
              <p className="eyebrow">Your mission</p>
              <h2 id="restaurant-tip-title">用简单英语完成一次儿童餐厅点餐</h2>
            </div>
            <ul className="simulation-tip-list">
              <li><span>01</span><div><strong>先选一种食物</strong><small>Pizza or noodles?</small></div></li>
              <li><span>02</span><div><strong>再选一种饮料</strong><small>Water, milk or juice?</small></div></li>
              <li><span>03</span><div><strong>礼貌确认订单</strong><small>That&apos;s all, thank you.</small></div></li>
            </ul>
            <div className="simulation-tip-example">
              <span>参考表达</span>
              <strong>I&apos;d like pizza, please.</strong>
            </div>
            <div className="eval-actions">
              <button className="primary-btn" type="button" onClick={() => setShowTips(false)}>继续模拟</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
