function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const nested of Object.values(value)) deepFreeze(nested);
  return value;
}

function pick(items, random) {
  if (!items.length) throw new Error("IELTS paper assembly has no compatible candidates");
  const index = Math.min(items.length - 1, Math.floor(random() * items.length));
  return items[index];
}

function preferFresh(items, recent, idOf) {
  const fresh = items.filter((item) => !recent.has(idOf(item)));
  return { items: fresh.length ? fresh : items, relaxed: fresh.length === 0 && items.length > 0 };
}

function selectDistinct(items, count, random) {
  const available = [...items];
  const selected = [];
  while (selected.length < count && available.length) {
    const item = pick(available, random);
    selected.push(item);
    available.splice(available.indexOf(item), 1);
  }
  if (selected.length < count) throw new Error(`IELTS paper assembly requires ${count} distinct candidates`);
  return selected;
}

function snapshotQuestion(question, extra = {}) {
  return {
    questionId: question.questionId,
    version: question.version,
    renderedText: question.renderedText,
    probes: [...(question.probes || [])],
    ...extra,
  };
}

function selectQuestions(group, count, recent, random) {
  const preferred = group.questions.filter((question) => !recent.has(question.questionId));
  const candidates = preferred.length >= count ? preferred : group.questions;
  return selectDistinct(candidates, Math.min(count, candidates.length), random)
    .map((question) => snapshotQuestion(question, { groupId: group.groupId, topic: group.topic }));
}

function createPart1(bank, recent, random, practiceOnly) {
  const eligibleGroups = bank.part1Groups.filter((group) =>
    !recent.has(group.groupId) || group.questions.some((question) => !recent.has(question.questionId)));
  const groupPool = eligibleGroups.length >= (practiceOnly ? 1 : 2) ? eligibleGroups : bank.part1Groups;
  const groups = selectDistinct(groupPool, practiceOnly ? 1 : 2, random);
  return {
    groups: groups.map((group) => ({
      groupId: group.groupId,
      version: group.version,
      topic: group.topic,
      trainingLevel: group.trainingLevel,
    })),
    questions: groups.flatMap((group) => selectQuestions(group, practiceOnly ? 2 : 1, recent, random)),
    targetSeconds: bank.config.part1TargetSeconds,
  };
}

function createPart2(bank, recent, random) {
  const cardSelection = preferFresh(bank.part2Cards, recent, (card) => card.cardId);
  const card = pick(cardSelection.items, random);
  const roundingSelection = preferFresh(card.roundingOffQuestions, recent, (question) => question.questionId);
  return {
    cardId: card.cardId,
    version: card.version,
    topicCluster: card.topicCluster,
    trainingLevel: card.trainingLevel,
    topicSentence: card.topicSentence,
    youShouldSay: [...card.youShouldSay],
    explain: card.explain,
    roundingOffQuestions: [snapshotQuestion(pick(roundingSelection.items, random), { parentCardId: card.cardId })],
    prepSeconds: bank.config.part2PrepSeconds,
    answerMaxSeconds: bank.config.part2AnswerMaxSeconds,
    historyRelaxed: cardSelection.relaxed || roundingSelection.relaxed,
  };
}

function createPart3(bank, part2, recent, random) {
  const compatible = part2
    ? bank.part3Groups.filter((group) => group.topicCluster === part2.topicCluster)
    : bank.part3Groups;
  if (!compatible.length) throw new Error(`No Part 3 group matches topic_cluster ${part2?.topicCluster || "any"}`);
  const groupSelection = preferFresh(compatible, recent, (group) => group.groupId);
  const group = pick(groupSelection.items, random);
  return {
    groupId: group.groupId,
    version: group.version,
    topicCluster: group.topicCluster,
    trainingLevel: group.trainingLevel,
    questions: selectQuestions(group, 2, recent, random),
    targetSeconds: bank.config.part3TargetSeconds,
    historyRelaxed: groupSelection.relaxed,
  };
}

function timestampId(now) {
  return now().toISOString().replace(/[-:.]/g, "").replace("Z", "");
}

export function assemblePaper(bank, options = {}) {
  if (!bank?.part1Groups || !bank?.part2Cards || !bank?.part3Groups) {
    throw new Error("A validated IELTS question bank is required");
  }
  const mode = options.mode || "full_mock";
  const selectedPart = options.selectedPart || null;
  if (!new Set(["full_mock", "practice_part"]).has(mode)) throw new Error(`Unsupported IELTS mode: ${mode}`);
  if (mode === "practice_part" && !new Set(["part1", "part2", "part3"]).has(selectedPart)) {
    throw new Error("Part practice requires selectedPart part1, part2 or part3");
  }

  const random = options.random || Math.random;
  const now = options.now || (() => new Date());
  const recent = new Set(options.recentQuestionIds || []);
  const include = (part) => mode === "full_mock" || selectedPart === part;
  const part2 = include("part2") ? createPart2(bank, recent, random) : null;
  const parts = {
    part1: include("part1") ? createPart1(bank, recent, random, mode === "practice_part") : null,
    part2,
    part3: include("part3") ? createPart3(bank, mode === "full_mock" ? part2 : null, recent, random) : null,
  };

  const snapshot = {
    paperId: `paper_${timestampId(now)}`,
    bankVersion: bank.bankVersion,
    schemaVersion: bank.schemaVersion,
    mode,
    selectedPart,
    createdAt: now().toISOString(),
    parts,
    assemblyPolicy: {
      profile: "accelerated_demo",
      recentCompletedSessionsToAvoid: bank.config.recentSessionsToAvoid,
      recentCandidateCount: recent.size,
      historyRelaxed: Boolean(parts.part2?.historyRelaxed || parts.part3?.historyRelaxed),
      productionDurations: {
        part1TargetSeconds: bank.config.part1TargetSeconds,
        part2PrepSeconds: bank.config.part2PrepSeconds,
        part2AnswerMaxSeconds: bank.config.part2AnswerMaxSeconds,
        part3TargetSeconds: bank.config.part3TargetSeconds,
      },
    },
  };
  return deepFreeze(snapshot);
}
