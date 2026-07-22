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

function requirePositive(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error(`${label} must be positive`);
  return number;
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
    order: requirePositive(question.order, `${label}.order`),
    renderedText: requireText(question.text, `${label}.text`),
    rawText: typeof question.raw_text === "string" ? question.raw_text : question.text,
    eligible: question.eligible !== false,
    needsReview: Boolean(question.needs_review),
    warnings: Array.isArray(question.warnings) ? [...question.warnings] : [],
    sourcePageStart: question.source_page_start ?? null,
    sourcePageEnd: question.source_page_end ?? null,
  };
}

function normalizeTiming(value, label) {
  requireObject(value, label);
  return {
    introductionMaxSeconds: requirePositive(value.introduction_max_seconds, `${label}.introduction_max_seconds`),
    part1AnswerMaxSeconds: requirePositive(value.part1_answer_max_seconds, `${label}.part1_answer_max_seconds`),
    part2PrepSeconds: requirePositive(value.part2_prep_seconds, `${label}.part2_prep_seconds`),
    part2AnswerMaxSeconds: requirePositive(value.part2_answer_max_seconds, `${label}.part2_answer_max_seconds`),
    part3AnswerMaxSeconds: requirePositive(value.part3_answer_max_seconds, `${label}.part3_answer_max_seconds`),
    part3SoftLimitSeconds: requirePositive(value.part3_soft_limit_seconds, `${label}.part3_soft_limit_seconds`),
    part3HardLimitSeconds: requirePositive(value.part3_hard_limit_seconds, `${label}.part3_hard_limit_seconds`),
  };
}

function normalizeManifest(manifest) {
  requireObject(manifest, "manifest");
  requireObject(manifest.files, "manifest.files");
  const defaults = requireObject(manifest.defaults, "manifest.defaults");
  return {
    bankVersion: requireText(manifest.bank_version, "manifest.bank_version"),
    schemaVersion: requireVersion(manifest.schema_version, "manifest.schema_version"),
    locale: typeof manifest.locale === "string" ? manifest.locale : "en-GB",
    files: {
      part1: requireText(manifest.files.part1, "manifest.files.part1"),
      part2Part3: requireText(manifest.files.part2_part3, "manifest.files.part2_part3"),
    },
    config: {
      recentSessionsToAvoid: Number(defaults.recent_completed_sessions_to_avoid || 5),
      realExam: normalizeTiming(defaults.real_exam, "manifest.defaults.real_exam"),
      acceleratedDemo: normalizeTiming(defaults.accelerated_demo, "manifest.defaults.accelerated_demo"),
    },
  };
}

export function validateQuestionBank(source) {
  requireObject(source, "question bank");
  const manifest = normalizeManifest(source.manifest);
  const registerId = createIdRegistry();

  const part1Groups = requireArray(source.part1?.groups, "part1.groups").map((group, groupIndex) => {
    const label = `part1.groups[${groupIndex}]`;
    requireObject(group, label);
    const groupId = registerId(group.group_id, `${label}.group_id`);
    const questions = requireArray(group.questions, `${label}.questions`)
      .map((item, index) => normalizeQuestion(item, registerId, `${label}.questions[${index}]`))
      .sort((a, b) => a.order - b.order);
    return {
      groupId,
      version: requireVersion(group.version, `${label}.version`),
      status: requireText(group.status, `${label}.status`),
      eligible: group.eligible !== false,
      topic: requireText(group.topic, `${label}.topic`),
      sequence: requirePositive(group.sequence, `${label}.sequence`),
      trainingLevel: requireText(group.training_level, `${label}.training_level`),
      needsReview: Boolean(group.needs_review),
      warnings: Array.isArray(group.warnings) ? [...group.warnings] : [],
      questions,
    };
  });

  const part2Part3Bundles = requireArray(source.part2Part3?.bundles, "part2_part3.bundles")
    .map((bundle, bundleIndex) => {
      const label = `part2_part3.bundles[${bundleIndex}]`;
      requireObject(bundle, label);
      const topicId = registerId(bundle.topic_id, `${label}.topic_id`);
      const part2 = requireObject(bundle.part2, `${label}.part2`);
      const cardId = requireText(part2.card_id, `${label}.part2.card_id`);
      if (cardId !== topicId) throw new Error(`${label}.part2.card_id must equal atomic topic_id ${topicId}`);
      const cuePoints = requireArray(part2.cue_points, `${label}.part2.cue_points`, 3)
        .map((cue, index) => {
          requireObject(cue, `${label}.part2.cue_points[${index}]`);
          return {
            cueId: registerId(cue.cue_id, `${label}.part2.cue_points[${index}].cue_id`),
            order: requirePositive(cue.order, `${label}.part2.cue_points[${index}].order`),
            text: requireText(cue.text, `${label}.part2.cue_points[${index}].text`),
            needsReview: Boolean(cue.needs_review),
            warnings: Array.isArray(cue.warnings) ? [...cue.warnings] : [],
          };
        }).sort((a, b) => a.order - b.order);
      const part3Questions = requireArray(bundle.part3?.questions, `${label}.part3.questions`)
        .map((item, index) => {
          const question = normalizeQuestion(item, registerId, `${label}.part3.questions[${index}]`);
          if (!question.questionId.startsWith(`${topicId}_p3_`)) {
            throw new Error(`Part 3 question ${question.questionId} does not belong to ${topicId}`);
          }
          return question;
        }).sort((a, b) => a.order - b.order);
      return {
        topicId,
        version: requireVersion(bundle.version, `${label}.version`),
        status: requireText(bundle.status, `${label}.status`),
        eligible: bundle.eligible !== false,
        title: requireText(bundle.title, `${label}.title`),
        sequence: requirePositive(bundle.sequence, `${label}.sequence`),
        needsReview: Boolean(bundle.needs_review),
        warnings: Array.isArray(bundle.warnings) ? [...bundle.warnings] : [],
        cardId,
        topicSentence: requireText(part2.topic_sentence, `${label}.part2.topic_sentence`),
        cuePoints,
        part3Questions,
      };
    });

  const activePart1 = part1Groups.filter((group) => group.status === "active" && group.eligible
    && group.questions.filter((question) => question.eligible).length >= 4);
  const activeBundles = part2Part3Bundles.filter((bundle) => bundle.status === "active" && bundle.eligible);
  if (!activePart1.length) throw new Error("IELTS question bank requires an active Part 1 group with four usable questions");
  if (!activeBundles.length) throw new Error("IELTS question bank requires an active atomic Part 2/3 bundle");

  return {
    bankVersion: manifest.bankVersion,
    schemaVersion: manifest.schemaVersion,
    locale: manifest.locale,
    config: manifest.config,
    part1Groups: activePart1,
    part2Part3Bundles: activeBundles,
  };
}

export async function loadQuestionBank(loadJson, manifestPath = "manifest.json") {
  if (typeof loadJson !== "function") throw new Error("loadJson must be a function");
  const manifest = await loadJson(manifestPath);
  const normalizedManifest = normalizeManifest(manifest);
  const [part1, part2Part3] = await Promise.all([
    loadJson(normalizedManifest.files.part1),
    loadJson(normalizedManifest.files.part2Part3),
  ]);
  return validateQuestionBank({ manifest, part1, part2Part3 });
}
