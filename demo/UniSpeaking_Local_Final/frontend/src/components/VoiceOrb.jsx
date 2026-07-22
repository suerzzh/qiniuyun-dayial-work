import React from "react";

export default function VoiceOrb({ state = "ready", label = "点击开始说话", onClick }) {
  return (
    <button
      className={`voice-orb is-${state}`}
      type="button"
      onClick={onClick}
      aria-label={label}
    >
      <span className="orb-core"></span>
      <span className="orb-ring ring-a"></span>
      <span className="orb-ring ring-b"></span>
      <span className="orb-bars" aria-hidden="true">
        {Array.from({ length: 7 }, (_, index) => (
          <i key={index}></i>
        ))}
      </span>
    </button>
  );
}
