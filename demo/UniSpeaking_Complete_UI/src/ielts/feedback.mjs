function safeAnswers(session) {
  return Array.isArray(session.answers) ? session.answers : [];
}

function transcriptWords(answers) {
  return answers
    .flatMap((answer) => String(answer.transcript || "").trim().split(/\s+/))
    .filter(Boolean);
}

export function buildPracticeFeedback(session) {
  const answers = safeAnswers(session);
  const words = transcriptWords(answers);
  const totalDurationMs = answers.reduce((total, answer) => total + Number(answer.durationMs || 0), 0);
  const averageWords = answers.length ? Math.round(words.length / answers.length) : 0;
  const status = session.status === "completed" ? "completed" : "partial";

  return {
    kind: "ai_practice_feedback",
    disclaimer: "本报告是参考 IELTS Speaking 维度的 AI 练习反馈，不是官方成绩。",
    status,
    summary: {
      mode: session.mode || "practice_part",
      answerCount: answers.length,
      totalDurationMs,
      captionsUsed: Boolean(session.captionsUsed),
      recordingEnabled: Boolean(session.recordingEnabled),
    },
    dimensions: {
      fluencyCoherence: {
        label: "Fluency & Coherence",
        status: answers.length ? "assessed" : "insufficient_evidence",
        evidence: answers.length
          ? `已记录 ${answers.length} 段回答，平均每段约 ${averageWords} 个词；反馈仅基于本次转写和用时。`
          : "本次没有足够的完整回答。",
        strength: answers.length ? "能够围绕问题产出可复盘的连续回答。" : "暂无足够证据。",
        nextStep: "下次用“观点—原因—例子”结构展开每个核心问题。",
      },
      lexicalResource: {
        label: "Lexical Resource",
        status: words.length ? "assessed" : "insufficient_evidence",
        evidence: words.length
          ? `词汇证据取自 ${words.length} 个转写词，未使用题库外推测。`
          : "无可用转写词汇证据。",
        strength: words.length ? "已使用与当前话题相关的实质性表达。" : "暂无足够证据。",
        nextStep: "从本次转写中选 2 个重复用词，为它们准备更精确的同义表达。",
      },
      grammaticalRangeAccuracy: {
        label: "Grammatical Range & Accuracy",
        status: answers.length ? "assessed" : "insufficient_evidence",
        evidence: answers.length
          ? "语法观察只基于保存的回答转写，ASR 不确定处不作绝对判定。"
          : "没有可用的完整句转写。",
        strength: answers.length ? "已使用完整句回应考官问题。" : "暂无足够证据。",
        nextStep: "复盘时将一个简单句扩展为含 because、although 或 which 的复合句。",
      },
      pronunciation: {
        label: "Pronunciation",
        status: "not_assessed",
        evidence: session.recordingEnabled
          ? "Demo 已记录录音授权选择，但未启用可靠的声学分析，因此本维度未评估。"
          : "未保存可分析的原始音频，不根据文字转写猜测发音。",
        strength: "暂无可靠音频证据。",
        nextStep: "如需发音复盘，下次在开考前主动开启录音。",
      },
    },
  };
}
