// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import FiveDimensionRadar from "../src/components/ielts/FiveDimensionRadar.jsx";
import IeltsReportView from "../src/components/ielts/IeltsReportView.jsx";

afterEach(cleanup);

const completeReport = {
  overallBand: 6.5,
  scoringStatus: "COMPLETE",
  bandRange: [6, 7],
  confidence: 0.86,
  officialDimensions: {
    fluencyCoherence: {
      code: "FC",
      band: 6.5,
      confidence: 0.88,
      positiveEvidence: ["表达流畅"],
      limitingEvidence: ["偶有停顿"],
    },
    lexicalResource: {
      code: "LR",
      band: 6,
      confidence: 0.84,
      positiveEvidence: ["词汇选择恰当"],
      limitingEvidence: ["词汇变化有限"],
    },
    grammaticalRangeAccuracy: {
      code: "GRA",
      band: 6.5,
      confidence: 0.82,
      positiveEvidence: ["使用了复合句"],
      limitingEvidence: ["少量时态错误"],
    },
    pronunciation: {
      code: "P",
      band: 7,
      confidence: 0.9,
      positiveEvidence: ["重音清晰"],
      limitingEvidence: ["连读可继续改善"],
    },
  },
  taskAchievement: {
    score: 82,
    confidence: 0.85,
    positiveEvidence: ["回答切题并充分展开"],
    limitingEvidence: ["个别追问可增加细节"],
  },
  radarDimensions: [
    { code: "FC", label: "流利度与连贯性", score: 72 },
    { code: "LR", label: "词汇资源", score: 67 },
    { code: "GRA", label: "语法多样性与准确性", score: 72 },
    { code: "P", label: "发音", score: 78 },
    { code: "TA", label: "任务完成度/互动回应", score: 82 },
  ],
  partSummaries: {
    part1: "回答自然，信息完整",
    part2: "故事结构清晰",
    part3: "观点有逻辑",
  },
  dataQualityWarnings: ["一段发音证据置信度较低"],
  disclaimer: "本报告为练习评估，不代表 IELTS 官方成绩。",
};

describe("IeltsReportView", () => {
  it("renders the official report and keeps TA in a separate training section", () => {
    const onRestart = vi.fn();
    render(<IeltsReportView report={completeReport} onRestart={onRestart} />);

    expect(screen.getByRole("heading", { name: /Overall 6\.5/ })).toBeInTheDocument();
    expect(screen.getByText("预估区间：6.0–7.0")).toBeInTheDocument();
    expect(screen.getByText("置信度：86%")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /五维训练诊断/ })).toBeInTheDocument();
    expect(screen.getByText("任务完成度/互动回应")).toBeInTheDocument();
    expect(screen.getByText(/不属于 IELTS 官方评分项/)).toBeInTheDocument();

    const officialSection = screen.getByRole("region", { name: "IELTS 官方四项" });
    expect(within(officialSection).getAllByRole("article")).toHaveLength(4);
    expect(within(officialSection).queryByText("任务完成度/互动回应")).not.toBeInTheDocument();
    expect(screen.getByText("回答切题并充分展开")).toBeInTheDocument();
    expect(screen.getByText("回答自然，信息完整")).toBeInTheDocument();
    expect(screen.getByText("一段发音证据置信度较低")).toBeInTheDocument();
    expect(screen.getByText(completeReport.disclaimer)).toBeInTheDocument();

    const taskSection = screen.getByRole("region", { name: "任务完成度/互动回应" });
    expect(within(taskSection).getByRole("heading", { name: "正向证据", level: 3 })).toBeInTheDocument();
    const firstOfficialCard = within(officialSection).getAllByRole("article")[0];
    expect(within(firstOfficialCard).getByRole("heading", { name: "正向证据", level: 4 })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "重新测试" }));
    expect(onRestart).toHaveBeenCalledOnce();
  });

  it("presents null data as unavailable rather than zero", () => {
    const partialReport = {
      ...completeReport,
      overallBand: null,
      scoringStatus: "PARTIAL",
      officialDimensions: {
        ...completeReport.officialDimensions,
        pronunciation: {
          code: "P",
          band: null,
          unavailableReason: "发音证据不可用",
          positiveEvidence: [],
          limitingEvidence: [],
        },
      },
      taskAchievement: {
        score: null,
        confidence: null,
        positiveEvidence: [],
        limitingEvidence: [],
        unavailableReason: "任务证据不可用",
      },
      radarDimensions: completeReport.radarDimensions.map((item) =>
        item.code === "P" || item.code === "TA" ? { ...item, score: null } : item,
      ),
    };

    render(<IeltsReportView report={partialReport} onRestart={() => {}} />);

    expect(screen.getByText("部分诊断")).toBeInTheDocument();
    expect(screen.getAllByText(/不可用/).length).toBeGreaterThan(0);
    expect(screen.queryByRole("heading", { name: /^Overall 0(?:\.0)?$/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/^Band 0(?:\.0)?$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^0\s*\/\s*100$/)).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: /P 不可用.*TA 不可用/ })).toBeInTheDocument();
  });
});

describe("FiveDimensionRadar", () => {
  it("draws a data polygon only when all five dimensions are finite", () => {
    const { container, rerender } = render(
      <FiveDimensionRadar dimensions={completeReport.radarDimensions} complete />,
    );

    expect(container.querySelector("[data-radar-polygon]")).toBeInTheDocument();

    rerender(
      <FiveDimensionRadar
        dimensions={completeReport.radarDimensions.map((item) =>
          item.code === "P" ? { ...item, score: null } : item,
        )}
        complete={false}
      />,
    );

    expect(container.querySelector("[data-radar-polygon]")).not.toBeInTheDocument();
  });

  it("keeps canonical axes when an input dimension is omitted", () => {
    const dimensionsWithoutPronunciation = completeReport.radarDimensions.filter(
      (item) => item.code !== "P",
    );
    const { container } = render(
      <FiveDimensionRadar dimensions={dimensionsWithoutPronunciation} complete />,
    );

    expect(screen.getByRole("img", {
      name: /FC 72分；LR 67分；GRA 72分；P 不可用；TA 82分/,
    })).toBeInTheDocument();
    expect(container.querySelectorAll(".ielts-radar-grid line")).toHaveLength(5);
    expect(container.querySelectorAll(".ielts-radar-labels text")).toHaveLength(5);
    expect(container.querySelector("[data-radar-polygon]")).not.toBeInTheDocument();
  });
});
