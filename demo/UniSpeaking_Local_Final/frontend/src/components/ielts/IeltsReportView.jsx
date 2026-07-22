import React from "react";
import { normalizeIeltsReport } from "../../ielts/report-model.mjs";
import FiveDimensionRadar from "./FiveDimensionRadar.jsx";

const OFFICIAL_DIMENSIONS = [
  ["fluencyCoherence", "FC", "Fluency and Coherence", "流利度与连贯性"],
  ["lexicalResource", "LR", "Lexical Resource", "词汇资源"],
  ["grammaticalRangeAccuracy", "GRA", "Grammatical Range and Accuracy", "语法多样性与准确性"],
  ["pronunciation", "P", "Pronunciation", "发音"],
];

const PART_LABELS = {
  part1: "Part 1",
  part2: "Part 2",
  part3: "Part 3",
};

function percent(value) {
  return Number.isFinite(value) ? `${Math.round(value * 100)}%` : "不可用";
}

function band(value) {
  return Number.isFinite(value) ? Number(value).toFixed(1) : "不可用";
}

function EvidenceList({ title, items = [], emptyLabel }) {
  return (
    <div className="ielts-evidence-group">
      <h4>{title}</h4>
      {items.length > 0 ? (
        <ul>
          {items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
        </ul>
      ) : (
        <p>{emptyLabel}</p>
      )}
    </div>
  );
}

function OfficialDimensionCard({ dimension, code, englishLabel, chineseLabel }) {
  const available = Number.isFinite(dimension?.band);

  return (
    <article className="ielts-official-card" aria-labelledby={`ielts-dimension-${code}`}>
      <header>
        <p>{code} · IELTS 官方评分项</p>
        <h3 id={`ielts-dimension-${code}`}>{englishLabel}</h3>
        <p>{chineseLabel}</p>
      </header>
      <p className="ielts-band-value">Band {band(dimension?.band)}</p>
      {Number.isFinite(dimension?.confidence) && <p>置信度：{percent(dimension.confidence)}</p>}
      {!available && <p>{dimension?.unavailableReason ?? "暂无可用证据"}</p>}
      <EvidenceList
        title="正向证据"
        items={dimension?.positiveEvidence}
        emptyLabel={available ? "暂无补充证据" : "不可用"}
      />
      <EvidenceList
        title="限制因素"
        items={dimension?.limitingEvidence}
        emptyLabel={available ? "暂无明显限制因素" : "不可用"}
      />
    </article>
  );
}

export default function IeltsReportView({ report, onRestart, onRetry }) {
  const normalized = normalizeIeltsReport(report);
  const range = normalized.bandRange.filter(Number.isFinite);
  const rangeLabel = range.length >= 2
    ? `${Number(range[0]).toFixed(1)}–${Number(range[1]).toFixed(1)}`
    : "不可用";
  const taskAchievement = normalized.taskAchievement;
  const taskAvailable = Number.isFinite(taskAchievement.score);
  const partSummaries = Object.entries(normalized.partSummaries);

  return (
    <main className="ielts-report-view">
      <header className="ielts-report-summary">
        <p>IELTS Speaking 训练报告</p>
        <h1>Overall {band(normalized.overallBand)}</h1>
        <p>预估区间：{rangeLabel}</p>
        <p>置信度：{percent(normalized.confidence)}</p>
      </header>

      <section className="ielts-radar-section" aria-labelledby="ielts-radar-heading">
        <header>
          <h2 id="ielts-radar-heading">UniSpeaking 五维训练诊断</h2>
          <p>{normalized.radarComplete ? "完整诊断" : "部分诊断"}</p>
        </header>
        <FiveDimensionRadar
          dimensions={normalized.radarDimensions}
          complete={normalized.radarComplete}
        />
        <p>
          任务完成度/互动回应不属于 IELTS 官方评分项，也不参与 Overall。
        </p>
      </section>

      <section className="ielts-official-dimensions" aria-label="IELTS 官方四项">
        <h2>IELTS 官方四项</h2>
        <div className="ielts-official-grid">
          {OFFICIAL_DIMENSIONS.map(([key, code, englishLabel, chineseLabel]) => (
            <OfficialDimensionCard
              key={key}
              dimension={normalized.officialDimensions[key]}
              code={code}
              englishLabel={englishLabel}
              chineseLabel={chineseLabel}
            />
          ))}
        </div>
      </section>

      <section className="ielts-task-achievement" aria-labelledby="ielts-task-heading">
        <p>UniSpeaking 训练维度</p>
        <h2 id="ielts-task-heading">任务完成度/互动回应</h2>
        <p className="ielts-task-score">
          {taskAvailable ? `${taskAchievement.score} / 100` : "不可用"}
        </p>
        {Number.isFinite(taskAchievement.confidence) && (
          <p>置信度：{percent(taskAchievement.confidence)}</p>
        )}
        {!taskAvailable && <p>{taskAchievement.unavailableReason ?? "任务完成度暂不可用"}</p>}
        <EvidenceList
          title="正向证据"
          items={taskAchievement.positiveEvidence}
          emptyLabel={taskAvailable ? "暂无补充证据" : "不可用"}
        />
        <EvidenceList
          title="限制因素"
          items={taskAchievement.limitingEvidence}
          emptyLabel={taskAvailable ? "暂无明显限制因素" : "不可用"}
        />
      </section>

      <section className="ielts-part-summaries" aria-labelledby="ielts-parts-heading">
        <h2 id="ielts-parts-heading">Part 总结</h2>
        {partSummaries.length > 0 ? (
          <dl>
            {partSummaries.map(([part, summary]) => (
              <div key={part}>
                <dt>{PART_LABELS[part] ?? part}</dt>
                <dd>{summary}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p>暂无 Part 总结</p>
        )}
      </section>

      {normalized.warnings.length > 0 && (
        <aside className="ielts-report-warnings" aria-labelledby="ielts-warnings-heading">
          <h2 id="ielts-warnings-heading">数据质量提示</h2>
          <ul>
            {normalized.warnings.map((warning, index) => (
              <li key={`${warning}-${index}`}>{warning}</li>
            ))}
          </ul>
        </aside>
      )}

      <section className="ielts-report-disclaimer" aria-labelledby="ielts-disclaimer-heading">
        <h2 id="ielts-disclaimer-heading">报告说明</h2>
        <p>{normalized.disclaimer || "本报告仅用于练习诊断，不代表 IELTS 官方成绩。"}</p>
      </section>

      <footer className="ielts-report-actions">
        <button type="button" onClick={onRestart}>重新测试</button>
        <button type="button" onClick={onRetry} disabled={!onRetry}>重新获取报告</button>
      </footer>
    </main>
  );
}
