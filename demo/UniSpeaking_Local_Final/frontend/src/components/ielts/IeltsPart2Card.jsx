import React from "react";

/** @typedef {{ cueId?: string, text: string }} CuePoint */
/**
 * @param {{
 *   card?: {
 *     cardId?: string,
 *     title?: string,
 *     topicSentence?: string,
 *     cuePoints?: CuePoint[],
 *     youShouldSay?: string[],
 *   } | null,
 *   notes?: string,
 *   notesEditable: boolean,
 *   onNotesChange: (notes: string) => unknown,
 * }} props
 */
export default function IeltsPart2Card({ card, notes, notesEditable, onNotesChange }) {
  const cues = /** @type {CuePoint[]} */ (
    card?.cuePoints || (card?.youShouldSay || []).map((text) => ({ text }))
  );

  return (
    <section className="ielts-part2-card" aria-label="Part 2 题卡">
      <header>
        <p>IELTS Speaking Part 2</p>
        {card?.title && <h2>{card.title}</h2>}
      </header>
      <p className="ielts-cue-topic">{card?.topicSentence}</p>
      <h3>You should say:</h3>
      <ul>
        {cues.map((cue, index) => (
          <li key={cue.cueId || `${cue.text}-${index}`}>{cue.text}</li>
        ))}
      </ul>
      <label>
        Part 2 备忘笔记
        <textarea
          aria-label="Part 2 备忘笔记"
          value={notes || ""}
          disabled={!notesEditable}
          onChange={(event) => onNotesChange(event.target.value)}
          placeholder={notesEditable ? "记下关键词，不用写完整句子" : "准备时间已结束"}
        />
      </label>
      <p>{notesEditable ? "准备阶段可编辑" : "回答阶段笔记已锁定"}</p>
    </section>
  );
}
