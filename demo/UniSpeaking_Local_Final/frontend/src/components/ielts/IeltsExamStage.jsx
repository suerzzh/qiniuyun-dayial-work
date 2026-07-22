import React from "react";
import IeltsPart2Card from "./IeltsPart2Card.jsx";

/** @typedef {{ cueId?: string, text: string }} CuePoint */
/** @typedef {{ renderedText?: string, topicSentence?: string }} Question */
/** @typedef {{ role?: string, text: string, at?: string }} Caption */
/**
 * @typedef {object} ExamStageSnapshot
 * @property {{ status?: string, currentPart?: string, currentItemIndex?: number, attemptNo?: number, mode?: string, captionsEnabled?: boolean } | null} [exam]
 * @property {{ parts?: {
 *   part1?: { questions?: Question[] } | null,
 *   part2?: { cardId?: string, title?: string, topicSentence?: string, cuePoints?: CuePoint[], youShouldSay?: string[] } | null,
 *   part3?: { questions?: Question[] } | null,
 * } } | null} [paper]
 * @property {{ kind?: string, remainingSeconds?: number } | null} [timer]
 * @property {{ elapsedSeconds?: number } | null} [part3Timer]
 * @property {string} [notes]
 * @property {boolean} [notesLocked]
 * @property {string} [liveTranscript]
 * @property {Caption[]} [captions]
 */

const STATUS_LABELS = /** @type {Record<string, string>} */ ({
  opening: "考试即将开始",
  introduction: "自我介绍",
  part1_answering: "Part 1 回答中",
  part2_preparing: "Part 2 准备中",
  part2_answering: "Part 2 长回答中",
  part3_answering: "Part 3 回答中",
});

/** @param {ExamStageSnapshot} snapshot @returns {Question | null} */
function currentItem(snapshot) {
  const { exam, paper } = snapshot;
  if (!exam || !paper) return null;
  if (exam.status === "introduction") return { renderedText: "Please introduce yourself." };
  if (exam.status === "part1_answering") return paper.parts?.part1?.questions?.[exam.currentItemIndex ?? 0] || null;
  if (exam.status === "part2_preparing" || exam.status === "part2_answering") return paper.parts?.part2 || null;
  if (exam.status === "part3_answering") return paper.parts?.part3?.questions?.[exam.currentItemIndex ?? 0] || null;
  return null;
}

/** @param {ExamStageSnapshot} snapshot */
function questionCount(snapshot) {
  const part = snapshot.exam?.currentPart;
  if (part === "part1") return snapshot.paper?.parts?.part1?.questions?.length || 0;
  if (part === "part3") return snapshot.paper?.parts?.part3?.questions?.length || 0;
  return part === "part2" ? 1 : 0;
}

/**
 * @param {{
 *   snapshot: ExamStageSnapshot,
 *   onSubmitAnswer: (text?: string, reason?: string) => unknown,
 *   onUpdateNotes: (notes: string) => unknown,
 *   onToggleCaptions: () => unknown,
 *   onRetry: () => unknown,
 *   onNext: () => unknown,
 *   onExit: () => unknown,
 * }} props
 */
export default function IeltsExamStage({ snapshot, onSubmitAnswer, onUpdateNotes, onToggleCaptions, onRetry, onNext, onExit }) {
  const exam = snapshot.exam;
  const item = currentItem(snapshot);
  const status = exam?.status;
  const part2Active = status === "part2_preparing" || status === "part2_answering";
  const answering = new Set(["introduction", "part1_answering", "part2_answering", "part3_answering"]).has(status || "");
  const practiceAnswering = exam?.mode === "practice_part" && answering && status !== "introduction";
  const count = questionCount(snapshot);
  const index = count > 0 ? Math.min((exam?.currentItemIndex || 0) + 1, count) : 0;

  return (
    <main className="ielts-exam-stage">
      <header>
        <p className="eyebrow">IELTS Speaking</p>
        <h1>{STATUS_LABELS[status || ""] || "考试进行中"}</h1>
        {exam?.currentPart && (
          <p>{exam.currentPart.replace("part", "Part ")}{count ? ` · ${index} / ${count}` : ""}</p>
        )}
        {snapshot.timer && (
          <p role="timer">剩余 {snapshot.timer.remainingSeconds} 秒</p>
        )}
        {snapshot.part3Timer && (
          <p>Part 3 总用时：{snapshot.part3Timer.elapsedSeconds} 秒</p>
        )}
      </header>

      {part2Active ? (
        <IeltsPart2Card
          card={snapshot.paper?.parts?.part2}
          notes={snapshot.notes}
          notesEditable={status === "part2_preparing" && !snapshot.notesLocked}
          onNotesChange={onUpdateNotes}
        />
      ) : item?.renderedText || item?.topicSentence ? (
        <section aria-labelledby="ielts-current-question">
          <h2 id="ielts-current-question">当前问题</h2>
          <p>{item.renderedText || item.topicSentence}</p>
        </section>
      ) : null}

      <section aria-labelledby="ielts-live-transcript">
        <h2 id="ielts-live-transcript">实时转写</h2>
        <output aria-live="polite">{snapshot.liveTranscript || "等待你开口回答…"}</output>
      </section>

      {exam?.captionsEnabled && (
        <section aria-labelledby="ielts-captions">
          <h2 id="ielts-captions">字幕</h2>
          {snapshot.captions?.length ? (
            <ol>
              {snapshot.captions.map((caption, indexValue) => (
                <li key={`${caption.at || indexValue}-${caption.role}`}>
                  <strong>{caption.role === "candidate" ? "你" : "考官"}：</strong>{caption.text}
                </li>
              ))}
            </ol>
          ) : <p>暂无字幕</p>}
        </section>
      )}

      <footer className="ielts-exam-actions">
        <button type="button" onClick={onToggleCaptions}>
          {exam?.captionsEnabled ? "关闭字幕" : "开启字幕"}
        </button>
        {practiceAnswering && <button type="button" onClick={onRetry}>重试本题</button>}
        {practiceAnswering && status !== "part2_answering" && <button type="button" onClick={onNext}>跳过本题</button>}
        {answering && status !== "part2_answering" && (
          <button type="button" onClick={() => onSubmitAnswer(undefined, "USER_DONE")}>完成本题</button>
        )}
        {status === "part2_answering" && (
          <button type="button" onClick={() => onSubmitAnswer(undefined, "USER_DONE")}>结束本轮回答</button>
        )}
        <button type="button" onClick={onExit}>退出测试</button>
      </footer>
    </main>
  );
}
