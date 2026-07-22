// @ts-nocheck

import React from "react";

const HEALTH_LABEL = {
  checking: "检查中",
  ready: "可用",
  unavailable: "不可用",
};

export default function IeltsPreflight({ selection, preflight, serviceHealth, onChange, onStart, onExit }) {
  const fullMock = selection?.mode === "full_mock";
  const startBlocked = serviceHealth?.status !== "ready"
    || serviceHealth?.service !== "ready"
    || serviceHealth?.microphone !== "ready";

  return (
    <main className="ielts-preflight">
      <header>
        <p className="eyebrow">Preflight</p>
        <h1>考前检查</h1>
        <p>{fullMock ? "完整模拟考试" : `${selection?.selectedPart?.toUpperCase() || "Part"} 单项练习`}</p>
      </header>

      <section aria-labelledby="ielts-device-health">
        <h2 id="ielts-device-health">设备与服务</h2>
        <p>麦克风：{HEALTH_LABEL[serviceHealth?.microphone] || "检查中"}</p>
        <p>本地服务：{serviceHealth?.service === "ready" ? "已连接" : HEALTH_LABEL[serviceHealth?.service] || "检查中"}</p>
        {serviceHealth?.messages?.length > 0 && (
          <ul aria-label="能力检查提示">
            {serviceHealth.messages.map((message) => <li key={message}>{message}</li>)}
          </ul>
        )}
      </section>

      <section aria-labelledby="ielts-session-options">
        <h2 id="ielts-session-options">本次设置</h2>
        <label>
          <input
            type="checkbox"
            checked={Boolean(preflight?.recordingEnabled)}
            onChange={(event) => onChange({ recordingEnabled: event.target.checked })}
          />
          保存本次录音用于评分
        </label>
        <label>
          <input
            type="checkbox"
            checked={Boolean(preflight?.captionsEnabled)}
            onChange={(event) => onChange({ captionsEnabled: event.target.checked })}
          />
          显示实时字幕
        </label>
        <label>
          <input
            type="checkbox"
            checked={Boolean(preflight?.acceleratedDemo)}
            onChange={(event) => onChange({ acceleratedDemo: event.target.checked })}
          />
          加速演示（Demo）
        </label>
        {fullMock && <p>关闭 Demo 后使用真实考试时长。</p>}
      </section>

      <footer>
        <button type="button" onClick={onExit}>退出</button>
        <button type="button" onClick={onStart} disabled={startBlocked}>开始测试</button>
      </footer>
    </main>
  );
}
