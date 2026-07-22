// @ts-nocheck

import React from "react";

export default function IeltsHome({ onSelectMode }) {
  return (
    <main className="ielts-home">
      <header>
        <p className="eyebrow">IELTS Speaking</p>
        <h1>IELTS 口语模拟与单项练习</h1>
        <p>选择一次完整模拟考试，或集中练习指定 Part。</p>
      </header>

      <section aria-labelledby="ielts-full-mock-heading">
        <h2 id="ielts-full-mock-heading">完整模拟考试</h2>
        <p>按 Introduction、Part 1、Part 2 和 Part 3 的顺序完成一次模拟。</p>
        <button type="button" onClick={() => onSelectMode("full_mock")}>
          开始完整模拟考试
        </button>
      </section>

      <section aria-labelledby="ielts-practice-heading">
        <h2 id="ielts-practice-heading">Part 单项练习</h2>
        <p>选择一个环节进行加速练习。</p>
        <div className="ielts-mode-grid">
          {[
            ["part1", "Part 1 单项练习", "日常话题问答"],
            ["part2", "Part 2 单项练习", "题卡准备与长回答"],
            ["part3", "Part 3 单项练习", "抽象话题讨论"],
          ].map(([part, label, description]) => (
            <button key={part} type="button" onClick={() => onSelectMode("practice_part", part)}>
              <strong>{label}</strong>
              <span>{description}</span>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
