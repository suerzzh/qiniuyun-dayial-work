function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireObject(value, label) {
  if (!isObject(value)) throw new Error(`${label} must be an object`);
  return value;
}

function requireArray(value, label, minimum = 1) {
  if (!Array.isArray(value) || value.length < minimum) {
    throw new Error(`${label} must contain at least ${minimum} item${minimum === 1 ? "" : "s"}`);
  }
  return value;
}

function requireText(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be non-empty text`);
  return value.trim();
}

function requireVersion(value, label) {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${label} must be a positive integer`);
  return value;
}

function createIdRegistry() {
  const ids = new Set();
  return (value, label) => {
    const id = requireText(value, label);
    if (ids.has(id)) throw new Error(`Duplicate IELTS question-bank id: ${id}`);
    ids.add(id);
    return id;
  };
}

function normalizeQuestion(question, registerId, label) {
  requireObject(question, label);
  return {
    questionId: registerId(question.question_id, `${label}.question_id`),
    version: requireVersion(question.version, `${label}.version`),
    renderedText: requireText(question.text, `${label}.text`),
    probes: Array.isArray(question.probes)
      ? question.probes.map((probe, index) => requireText(probe, `${label}.probes[${index}]`))
      : [],
  };
}

function normalizeManifest(manifest) {
  requireObject(manifest, "manifest");
  requireObject(manifest.files, "manifest.files");
  const defaults = requireObject(manifest.defaults || {}, "manifest.defaults");
  return {
    bankVersion: requireText(manifest.bank_version, "manifest.bank_version"),
    schemaVersion: requireVersion(manifest.schema_version, "manifest.schema_version"),
    locale: typeof manifest.locale === "string" ? manifest.locale : "en-GB",
    files: {
      part1: requireText(manifest.files.part1, "manifest.files.part1"),
      part2: requireText(manifest.files.part2, "manifest.files.part2"),
      part3: requireText(manifest.files.part3, "manifest.files.part3"),
    },
    config: {
      recentSessionsToAvoid: Number(defaults.recent_completed_sessions_to_avoid || 5),
      part1TargetSeconds: Number(defaults.part1_target_seconds || 270),
      part2PrepSeconds: Number(defaults.part2_prep_seconds || 60),
      part2AnswerMaxSeconds: Number(defaults.part2_answer_max_seconds || 120),
      part3TargetSeconds: Number(defaults.part3_target_seconds || 270),
    },
  };
}

export function validateQuestionBank(source) {
  requireObject(source, "question bank");
  const manifest = normalizeManifest(source.manifest);
  const registerId = createIdRegistry();

  const part1Groups = requireArray(source.part1?.groups, "part1.groups", 2).map((group, groupIndex) => {
    const label = `part1.groups[${groupIndex}]`;
    requireObject(group, label);
    const groupId = registerId(group.group_id, `${label}.group_id`);
    const questions = requireArray(group.questions, `${label}.questions`, 2)
      .map((question, index) => normalizeQuestion(question, registerId, `${label}.questions[${index}]`));
    return {
      groupId,
      version: requireVersion(group.version, `${label}.version`),
      status: requireText(group.status, `${label}.status`),
      topic: requireText(group.topic, `${label}.topic`),
      trainingLevel: requireText(group.training_level, `${label}.training_level`),
      questions,
    };
  });

  const part2Cards = requireArray(source.part2?.cards, "part2.cards").map((card, cardIndex) => {
    const label = `part2.cards[${cardIndex}]`;
    requireObject(card, label);
    const cardId = registerId(card.card_id, `${label}.card_id`);
    const bullets = requireArray(card.you_should_say, `${label}.you_should_say`, 3)
      .map((bullet, index) => requireText(bullet, `${label}.you_should_say[${index}]`));
    const roundingOffQuestions = requireArray(card.rounding_off_questions, `${label}.rounding_off_questions`)
      .map((question, index) => normalizeQuestion(question, registerId, `${label}.rounding_off_questions[${index}]`));
    return {
      cardId,
      version: requireVersion(card.version, `${label}.version`),
      status: requireText(card.status, `${label}.status`),
      topicCluster: requireText(card.topic_cluster, `${label}.topic_cluster`),
      trainingLevel: requireText(card.training_level, `${label}.training_level`),
      topicSentence: requireText(card.topic_sentence, `${label}.topic_sentence`),
      youShouldSay: bullets,
      explain: requireText(card.explain, `${label}.explain`),
      roundingOffQuestions,
    };
  });

  const part3Groups = requireArray(source.part3?.groups, "part3.groups").map((group, groupIndex) => {
    const label = `part3.groups[${groupIndex}]`;
    requireObject(group, label);
    const groupId = registerId(group.group_id, `${label}.group_id`);
    const questions = requireArray(group.questions, `${label}.questions`, 2)
      .map((question, index) => normalizeQuestion(question, registerId, `${label}.questions[${index}]`));
    return {
      groupId,
      version: requireVersion(group.version, `${label}.version`),
      status: requireText(group.status, `${label}.status`),
      topicCluster: requireText(group.topic_cluster, `${label}.topic_cluster`),
      trainingLevel: requireText(group.training_level, `${label}.training_level`),
      questions,
    };
  });

  const activePart1 = part1Groups.filter((group) => group.status === "active");
  const activePart2 = part2Cards.filter((card) => card.status === "active");
  const activePart3 = part3Groups.filter((group) => group.status === "active");
  if (activePart1.length < 2) throw new Error("IELTS question bank requires at least two active Part 1 groups");
  if (!activePart2.length) throw new Error("IELTS question bank requires an active Part 2 card");
  if (!activePart3.length) throw new Error("IELTS question bank requires an active Part 3 group");

  for (const card of activePart2) {
    if (!activePart3.some((group) => group.topicCluster === card.topicCluster)) {
      throw new Error(`No active Part 3 topic_cluster matches ${card.topicCluster}`);
    }
  }

  return {
    bankVersion: manifest.bankVersion,
    schemaVersion: manifest.schemaVersion,
    locale: manifest.locale,
    config: manifest.config,
    part1Groups: activePart1,
    part2Cards: activePart2,
    part3Groups: activePart3,
  };
}

export async function loadQuestionBank(loadJson, manifestPath = "manifest.json") {
  if (typeof loadJson !== "function") throw new Error("loadJson must be a function");
  const manifest = await loadJson(manifestPath);
  const normalizedManifest = normalizeManifest(manifest);
  const [part1, part2, part3] = await Promise.all([
    loadJson(normalizedManifest.files.part1),
    loadJson(normalizedManifest.files.part2),
    loadJson(normalizedManifest.files.part3),
  ]);
  return validateQuestionBank({ manifest, part1, part2, part3 });
}
