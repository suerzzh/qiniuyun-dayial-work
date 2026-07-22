import assert from "node:assert/strict";
import test from "node:test";

import { bandToRadarScore, normalizeIeltsReport } from "../src/ielts/report-model.mjs";

const completeReport = {
  overallBand: 6.5,
  scoringStatus: "COMPLETE",
  officialDimensions: {
    fluencyCoherence: { code: "FC", band: 6.5 },
    lexicalResource: { code: "LR", band: 6 },
    grammaticalRangeAccuracy: { code: "GRA", band: 6.5 },
    pronunciation: { code: "P", band: 7 },
  },
  taskAchievement: { score: 82, confidence: 0.86, positiveEvidence: [], limitingEvidence: [] },
  radarDimensions: [
    { code: "FC", label: "流利度与连贯性", score: 72 },
    { code: "LR", label: "词汇资源", score: 67 },
    { code: "GRA", label: "语法多样性与准确性", score: 72 },
    { code: "P", label: "发音", score: 78 },
    { code: "TA", label: "任务完成度/互动回应", score: 82 },
  ],
};

test("normalizes the complete backend report", () => {
  const report = normalizeIeltsReport(completeReport);

  assert.equal(report.overallBand, 6.5);
  assert.deepEqual(report.radarDimensions.map((item) => item.score), [72, 67, 72, 78, 82]);
  assert.equal(report.radarComplete, true);
});

test("marks a radar with a null score as incomplete", () => {
  const report = normalizeIeltsReport({ radarDimensions: [{ code: "P", score: null }] });

  assert.equal(report.radarComplete, false);
  assert.equal(report.radarDimensions.find((item) => item.code === "P").score, null);
});

test("derives official dimensions and radar scores from legacy fields", () => {
  const report = normalizeIeltsReport({
    overall_band: 6,
    scoring_status: "PARTIAL",
    fc: { code: "FC", band: 6.5 },
    lr: { code: "LR", band: 6 },
    gra: { code: "GRA", band: null, unavailableReason: "语法证据不足" },
    pronunciation: { code: "P", band: 7 },
  });

  assert.equal(report.overallBand, 6);
  assert.equal(report.officialDimensions.fluencyCoherence.band, 6.5);
  assert.equal(report.officialDimensions.lexicalResource.band, 6);
  assert.equal(report.officialDimensions.grammaticalRangeAccuracy.band, null);
  assert.equal(report.radarDimensions.find((item) => item.code === "GRA").score, null);
  assert.deepEqual(report.radarDimensions.map((item) => item.score), [72, 67, null, 78, null]);
  assert.equal(report.radarComplete, false);
});

test("does not coerce null, missing, or non-finite values to zero", () => {
  assert.equal(bandToRadarScore(null), null);
  assert.equal(bandToRadarScore(undefined), null);
  assert.equal(bandToRadarScore(Number.NaN), null);

  const report = normalizeIeltsReport({
    officialDimensions: {
      fluencyCoherence: { band: null },
      lexicalResource: { band: undefined },
      grammaticalRangeAccuracy: { band: Number.NaN },
      pronunciation: { band: 0 },
    },
    taskAchievement: { score: null },
  });

  assert.deepEqual(report.radarDimensions.map((item) => item.score), [null, null, null, 0, null]);
});
