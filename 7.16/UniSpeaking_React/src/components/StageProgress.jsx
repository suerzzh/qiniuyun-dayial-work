import React from "react";
import Icon from "./Icon";
import { TRAINING_STEPS } from "../data";

export default function StageProgress({ current, maxStage = "words" }) {
  const currentIndex = TRAINING_STEPS.findIndex((step) => step.id === current);
  const maxIndex = TRAINING_STEPS.findIndex((step) => step.id === maxStage);
  return (
    <ol className="stage-progress" aria-label="训练进度">
      {TRAINING_STEPS.map((step, index) => {
        const isCurrent = index === currentIndex;
        const isDone = index < maxIndex && !isCurrent;
        const isClickable = index <= maxIndex && !isCurrent;
        const inner = (
          <>
            <span>{isDone ? <Icon name="check" /> : index + 1}</span>
            <b>{step.label}</b>
          </>
        );
        return (
          <li key={step.id} className={isDone ? "done" : isCurrent ? "current" : ""}>
            {isClickable ? (
              <a href={`#/training/cafe/${step.id}`} className="progress-step-link" title={`跳转到${step.label}`}>
                {inner}
              </a>
            ) : (
              inner
            )}
          </li>
        );
      })}
    </ol>
  );
}
