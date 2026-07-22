/**
 * @typedef {object} IeltsDimension
 * @property {string} [code]
 * @property {number | null} [band]
 * @property {number | null} [confidence]
 * @property {string[]} [positiveEvidence]
 * @property {string[]} [limitingEvidence]
 * @property {string | null} [unavailableReason]
 */

/**
 * @typedef {object} TaskAchievement
 * @property {number | null} [score]
 * @property {number | null} [confidence]
 * @property {string[]} [positiveEvidence]
 * @property {string[]} [limitingEvidence]
 * @property {string | null} [unavailableReason]
 */

/**
 * @typedef {object} RadarDimension
 * @property {string} code
 * @property {string} [label]
 * @property {number | null} [score]
 */

/**
 * @typedef {object} RawIeltsReport
 * @property {number | null} [overallBand]
 * @property {number | null} [overall_band]
 * @property {string | null} [scoringStatus]
 * @property {string | null} [scoring_status]
 * @property {Record<string, IeltsDimension | null | undefined> | null} [officialDimensions]
 * @property {IeltsDimension | null} [fc]
 * @property {IeltsDimension | null} [lr]
 * @property {IeltsDimension | null} [gra]
 * @property {IeltsDimension | null} [pronunciation]
 * @property {TaskAchievement | null} [taskAchievement]
 * @property {RadarDimension[] | null} [radarDimensions]
 * @property {number[] | null} [bandRange]
 * @property {number[] | null} [band_range]
 * @property {number | null} [confidence]
 * @property {Record<string, string> | null} [partSummaries]
 * @property {Record<string, string> | null} [part_summaries]
 * @property {string[] | null} [dataQualityWarnings]
 * @property {string[] | null} [data_quality_warnings]
 * @property {string | null} [disclaimer]
 */

/** @typedef {"fluencyCoherence" | "lexicalResource" | "grammaticalRangeAccuracy" | "pronunciation"} OfficialDimensionKey */
/** @typedef {"fc" | "lr" | "gra" | "pronunciation"} LegacyDimensionKey */

/** @type {ReadonlyArray<readonly [string, string, OfficialDimensionKey, LegacyDimensionKey]>} */
const AXES = [
  ["FC", "流利度与连贯性", "fluencyCoherence", "fc"],
  ["LR", "词汇资源", "lexicalResource", "lr"],
  ["GRA", "语法多样性与准确性", "grammaticalRangeAccuracy", "gra"],
  ["P", "发音", "pronunciation", "pronunciation"],
];

/**
 * @param {number | null | undefined} band
 * @returns {number | null}
 */
export function bandToRadarScore(band) {
  return Number.isFinite(band) ? Math.round(Number(band) / 9 * 100) : null;
}

/**
 * @param {RawIeltsReport} [raw]
 */
export function normalizeIeltsReport(raw = {}) {
  const suppliedOfficial = raw.officialDimensions ?? {};
  const officialDimensions = Object.fromEntries(
    AXES.map(([, , key, legacy]) => [
      key,
      suppliedOfficial[key] ?? raw[legacy] ?? {
        band: null,
        unavailableReason: "暂无可用证据",
      },
    ]),
  );
  const taskAchievement = raw.taskAchievement ?? {
    score: null,
    confidence: null,
    positiveEvidence: [],
    limitingEvidence: [],
    unavailableReason: "任务完成度暂不可用",
  };
  const suppliedRadar = new Map(
    (raw.radarDimensions ?? []).map((item) => [item.code, item]),
  );
  const radarDimensions = [
    ...AXES.map(([code, label, key]) => suppliedRadar.get(code) ?? {
      code,
      label,
      score: bandToRadarScore(officialDimensions[key]?.band),
    }),
    suppliedRadar.get("TA") ?? {
      code: "TA",
      label: "任务完成度/互动回应",
      score: taskAchievement.score ?? null,
    },
  ].map((item) => ({
    ...item,
    score: Number.isFinite(item.score) ? Number(item.score) : null,
  }));

  return {
    overallBand: raw.overallBand ?? raw.overall_band ?? null,
    scoringStatus: raw.scoringStatus ?? raw.scoring_status ?? "PARTIAL",
    officialDimensions,
    taskAchievement,
    radarDimensions,
    radarComplete: radarDimensions.every((item) => Number.isFinite(item.score)),
    bandRange: raw.bandRange ?? raw.band_range ?? [],
    confidence: raw.confidence ?? null,
    partSummaries: raw.partSummaries ?? raw.part_summaries ?? {},
    warnings: raw.dataQualityWarnings ?? raw.data_quality_warnings ?? [],
    disclaimer: raw.disclaimer ?? "",
  };
}
