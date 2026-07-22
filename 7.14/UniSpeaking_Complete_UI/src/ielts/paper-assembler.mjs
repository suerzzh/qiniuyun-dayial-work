function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const nested of Object.values(value)) deepFreeze(nested);
  return value;
}

function pick(items, random) {
  if (!items.length) throw new Error("IELTS paper assembly has no compatible candidates");
  return items[Math.min(items.length - 1, Math.floor(random() * items.length))];
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
    order: question.order,
    renderedText: question.renderedText,
    rawText: question.rawText,
    needsReview: question.needsReview,
    warnings: [...(question.warnings || [])],
    ...extra,
  };
}

function createPart1(bank, recent, random) {
  const targetCount = random() < 0.5 ? 4 : 5;
  const eligible = bank.part1Groups.filter((group) =>
    group.questions.filter((question) => question.eligible).length >= targetCount);
  const groupSelection = preferFresh(eligible, recent, (group) => group.groupId);
  const group = pick(groupSelection.items, random);
  const usable = group.questions.filter((question) => question.eligible);
  const preferred = usable.filter((question) => !recent.has(question.questionId));
  const pool = preferred.length >= targetCount ? preferred : usable;
  const questions = selectDistinct(pool, targetCount, random)
    .sort((a, b) => a.order - b.order)
    .map((question) => snapshotQuestion(question, { groupId: group.groupId, topic: group.topic }));
  return {
    groups: [{
      groupId: group.groupId,
      version: group.version,
      topic: group.topic,
      sequence: group.sequence,
      trainingLevel: group.trainingLevel,
    }],
    questions,
    targetQuestionCount: targetCount,
    historyRelaxed: groupSelection.relaxed || preferred.length < targetCount,
  };
}

function selectBundle(bank, recent, random) {
  const selection = preferFresh(bank.part2Part3Bundles, recent, (bundle) => bundle.topicId);
  return { bundle: pick(selection.items, random), historyRelaxed: selection.relaxed };
}

function createPart2(bundle, timing) {
  return {
    topicId: bundle.topicId,
    cardId: bundle.cardId,
    version: bundle.version,
    title: bundle.title,
    topicSentence: bundle.topicSentence,
    cuePoints: bundle.cuePoints.map((cue) => ({ ...cue })),
    youShouldSay: bundle.cuePoints.map((cue) => cue.text),
    prepSeconds: timing.part2PrepSeconds,
    answerMaxSeconds: timing.part2AnswerMaxSeconds,
  };
}

function createPart3(bundle, timing) {
  return {
    topicId: bundle.topicId,
    groupId: bundle.topicId,
    version: bundle.version,
    title: bundle.title,
    questions: bundle.part3Questions.map((question) => snapshotQuestion(question, {
      groupId: bundle.topicId,
      topicId: bundle.topicId,
      topic: bundle.title,
    })),
    answerMaxSeconds: timing.part3AnswerMaxSeconds,
    softLimitSeconds: timing.part3SoftLimitSeconds,
    hardLimitSeconds: timing.part3HardLimitSeconds,
  };
}

function timestampId(now) {
  return now().toISOString().replace(/[-:.]/g, "").replace("Z", "");
}

export function assemblePaper(bank, options = {}) {
  if (!bank?.part1Groups || !bank?.part2Part3Bundles) {
    throw new Error("A validated atomic IELTS question bank is required");
  }
  const mode = options.mode || "full_mock";
  const selectedPart = options.selectedPart || null;
  if (!new Set(["full_mock", "practice_part"]).has(mode)) throw new Error(`Unsupported IELTS mode: ${mode}`);
  if (mode === "practice_part" && !new Set(["part1", "part2", "part3"]).has(selectedPart)) {
    throw new Error("Part practice requires selectedPart part1, part2 or part3");
  }
  const timingProfile = options.timingProfile || "real_exam";
  if (!new Set(["real_exam", "accelerated_demo"]).has(timingProfile)) {
    throw new Error(`Unsupported IELTS timing profile: ${timingProfile}`);
  }
  const timing = timingProfile === "accelerated_demo" ? bank.config.acceleratedDemo : bank.config.realExam;
  const random = options.random || Math.random;
  const now = options.now || (() => new Date());
  const recent = new Set(options.recentQuestionIds || []);
  const include = (part) => mode === "full_mock" || selectedPart === part;

  const needsBundle = include("part2") || include("part3");
  const selected = needsBundle ? selectBundle(bank, recent, random) : null;
  const part1 = include("part1") ? createPart1(bank, recent, random) : null;
  const part2 = include("part2") ? createPart2(selected.bundle, timing) : null;
  const part3 = include("part3") ? createPart3(selected.bundle, timing) : null;

  const snapshot = {
    paperId: `paper_${timestampId(now)}`,
    bankVersion: bank.bankVersion,
    schemaVersion: bank.schemaVersion,
    mode,
    selectedPart,
    createdAt: now().toISOString(),
    promptVersion: options.promptVersion || null,
    timingProfile,
    timing: { ...timing },
    part2Part3TopicId: selected?.bundle.topicId || null,
    parts: { part1, part2, part3 },
    assemblyPolicy: {
      profile: timingProfile,
      part1Policy: "single_topic_random_subset_source_order",
      part2Part3Policy: "atomic_source_topic_bundle",
      recentCompletedSessionsToAvoid: bank.config.recentSessionsToAvoid,
      recentCandidateCount: recent.size,
      historyRelaxed: Boolean(part1?.historyRelaxed || selected?.historyRelaxed),
    },
  };
  return deepFreeze(snapshot);
}
