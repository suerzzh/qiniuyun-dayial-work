export const IELTS_EXAMINER_PROMPT_VERSION = "ielts-examiner-2026-07-21.1";

export function createExaminerPromptCatalog({ examinerName = "Alex" } = {}) {
  const name = String(examinerName || "Alex").trim() || "Alex";
  return Object.freeze({
    version: IELTS_EXAMINER_PROMPT_VERSION,
    examinerName: name,
    opening: `Hello. My name is ${name}, and I’ll be your examiner for this IELTS Speaking practice test. Welcome. Before we begin, please introduce yourself. You have up to one minute.`,
    part1Start: "Thank you. Now, let’s begin Part 1.",
    part2Preparation: "Now, I’m going to give you a topic. You have one minute to think and prepare. You may make notes.",
    part2Start: "Your preparation time is over. You may begin speaking now.",
    part3Start: "Thank you. Now, let’s move on to Part 3.",
    ending: "Thank you. This is the end of the speaking test.",
    sayExactly: (text) => `Say exactly this IELTS examiner instruction, then wait: ${String(text || "").trim()}`,
    askQuestion: (text) => `Ask exactly this IELTS question, then wait silently: ${String(text || "").trim()}`,
  });
}
