// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useSession: vi.fn(),
  reportView: vi.fn(({ onRetry, onRestart }) => (
    <section data-testid="ielts-report-view">
      <button type="button" onClick={onRetry}>重新获取报告</button>
      <button type="button" onClick={onRestart}>重新测试</button>
    </section>
  )),
}));

vi.mock("../src/hooks/useIeltsSession.js", () => ({
  useIeltsSession: mocks.useSession,
}));

vi.mock("../src/components/ielts/IeltsReportView.jsx", () => ({
  default: mocks.reportView,
}));

import IeltsView from "../src/views/IeltsView.jsx";

afterEach(cleanup);

const cueCard = {
  cardId: "people_helpful",
  title: "A helpful person",
  topicSentence: "Describe a person who helped you.",
  cuePoints: [
    { cueId: "who", text: "who this person is" },
    { cueId: "when", text: "when they helped you" },
    { cueId: "how", text: "how they helped you" },
    { cueId: "why", text: "and explain why their help mattered" },
  ],
  prepSeconds: 60,
  answerMaxSeconds: 120,
};

function fakeSession(snapshotPatch = {}, healthPatch = {}) {
  return {
    snapshot: {
      screen: "home",
      loading: false,
      error: null,
      selection: null,
      preflight: {
        captionsEnabled: false,
        recordingEnabled: false,
        acceleratedDemo: false,
      },
      paper: null,
      exam: null,
      notes: "",
      notesLocked: true,
      captions: [],
      timer: null,
      part3Timer: null,
      report: null,
      ...snapshotPatch,
    },
    serviceHealth: {
      status: "ready",
      service: "ready",
      microphone: "ready",
      messages: [],
      ...healthPatch,
    },
    actions: {
      selectMode: vi.fn(),
      setPreflight: vi.fn(),
      start: vi.fn(),
      submitAnswer: vi.fn(),
      updateNotes: vi.fn(),
      toggleCaptions: vi.fn(),
      retry: vi.fn(),
      next: vi.fn(),
      exit: vi.fn(),
      restart: vi.fn(),
      retryReport: vi.fn(),
    },
  };
}

function part2Snapshot(status, patch = {}) {
  return {
    screen: "session",
    paper: {
      mode: "practice_part",
      selectedPart: "part2",
      parts: { part1: null, part2: cueCard, part3: null },
      timing: { part2PrepSeconds: 60, part2AnswerMaxSeconds: 120 },
    },
    exam: {
      mode: "practice_part",
      selectedPart: "part2",
      status,
      currentPart: "part2",
      currentItemIndex: 0,
      captionsEnabled: true,
      attemptNo: 1,
    },
    timer: {
      kind: status === "part2_preparing" ? "part2_preparation" : "part2_answer",
      totalSeconds: status === "part2_preparing" ? 60 : 120,
      remainingSeconds: status === "part2_preparing" ? 42 : 88,
    },
    notes: "Opening, example, feeling",
    notesLocked: status !== "part2_preparing",
    captions: [{ role: "examiner", text: "You may begin speaking now." }],
    ...patch,
  };
}

describe("IELTS React flow", () => {
  beforeEach(() => {
    mocks.useSession.mockReset();
    mocks.reportView.mockClear();
  });

  it("offers both a full mock and each Part practice choice", () => {
    const session = fakeSession();
    mocks.useSession.mockReturnValue(session);
    render(<IeltsView />);

    fireEvent.click(screen.getByRole("button", { name: /完整模拟考试/ }));
    fireEvent.click(screen.getByRole("button", { name: /Part 1/ }));
    fireEvent.click(screen.getByRole("button", { name: /Part 2/ }));
    fireEvent.click(screen.getByRole("button", { name: /Part 3/ }));

    expect(session.actions.selectMode).toHaveBeenNthCalledWith(1, "full_mock");
    expect(session.actions.selectMode).toHaveBeenNthCalledWith(2, "practice_part", "part1");
    expect(session.actions.selectMode).toHaveBeenNthCalledWith(3, "practice_part", "part2");
    expect(session.actions.selectMode).toHaveBeenNthCalledWith(4, "practice_part", "part3");
  });

  it("shows microphone/service health and an accelerated Demo switch before start", () => {
    const session = fakeSession({
      screen: "preflight",
      selection: { mode: "full_mock", selectedPart: null },
    });
    mocks.useSession.mockReturnValue(session);
    render(<IeltsView />);

    expect(screen.getByText(/麦克风/)).toHaveTextContent("可用");
    expect(screen.getByText(/本地服务/)).toHaveTextContent("已连接");

    const demoSwitch = screen.getByRole("checkbox", { name: /加速.*Demo/i });
    fireEvent.click(demoSwitch);
    expect(session.actions.setPreflight).toHaveBeenCalledWith({ acceleratedDemo: true });
  });

  it("keeps start unavailable when a required provider capability is missing", () => {
    const session = fakeSession({
      screen: "preflight",
      selection: { mode: "full_mock", selectedPart: null },
    }, {
      status: "degraded",
      messages: ["实时考官服务未配置"],
    });
    mocks.useSession.mockReturnValue(session);
    render(<IeltsView />);

    expect(screen.getByText("实时考官服务未配置")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "开始测试" })).toBeDisabled();
  });

  it("renders the complete Part 2 cue card and editable notes during preparation", () => {
    const session = fakeSession(part2Snapshot("part2_preparing"));
    mocks.useSession.mockReturnValue(session);
    render(<IeltsView />);

    const card = screen.getByRole("region", { name: "Part 2 题卡" });
    expect(within(card).getByText(cueCard.topicSentence)).toBeInTheDocument();
    for (const cue of cueCard.cuePoints) {
      expect(within(card).getByText(cue.text)).toBeInTheDocument();
    }

    const notes = within(card).getByRole("textbox", { name: "Part 2 备忘笔记" });
    expect(notes).toBeEnabled();
    fireEvent.change(notes, { target: { value: "A new outline" } });
    expect(session.actions.updateNotes).toHaveBeenCalledWith("A new outline");
    expect(screen.queryByRole("button", { name: "结束本轮回答" })).not.toBeInTheDocument();
  });

  it("locks Part 2 notes while answering and requires an explicit long-turn end", () => {
    const session = fakeSession(part2Snapshot("part2_answering"));
    mocks.useSession.mockReturnValue(session);
    render(<IeltsView />);

    expect(screen.getByRole("textbox", { name: "Part 2 备忘笔记" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "结束本轮回答" }));
    expect(session.actions.submitAnswer).toHaveBeenCalledWith(undefined, "USER_DONE");
  });

  it("delegates the report screen and its actions to IeltsReportView", () => {
    const report = { scoring_status: "COMPLETE", overallBand: 7 };
    const session = fakeSession({ screen: "report", report });
    mocks.useSession.mockReturnValue(session);
    render(<IeltsView />);

    expect(screen.getByTestId("ielts-report-view")).toBeInTheDocument();
    expect(mocks.reportView).toHaveBeenCalledWith(expect.objectContaining({ report }), expect.anything());
    fireEvent.click(screen.getByRole("button", { name: "重新获取报告" }));
    fireEvent.click(screen.getByRole("button", { name: "重新测试" }));
    expect(session.actions.retryReport).toHaveBeenCalledOnce();
    expect(session.actions.restart).toHaveBeenCalledOnce();
  });

  it("keeps retry and exit actions in a recoverable error state", () => {
    const session = fakeSession({
      screen: "preflight",
      selection: { mode: "full_mock", selectedPart: null },
      error: "麦克风连接失败",
    });
    mocks.useSession.mockReturnValue(session);
    render(<IeltsView />);

    expect(screen.getByText("麦克风连接失败")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    fireEvent.click(screen.getByRole("button", { name: "退出" }));
    expect(session.actions.start).toHaveBeenCalledOnce();
    expect(session.actions.exit).toHaveBeenCalledOnce();
  });

  it("allows exit but never exposes a second start while loading", () => {
    const session = fakeSession({
      screen: "preflight",
      selection: { mode: "full_mock", selectedPart: null },
      loading: true,
    });
    mocks.useSession.mockReturnValue(session);
    render(<IeltsView />);

    expect(screen.getByText(/正在/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "重试" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "退出" }));
    expect(session.actions.start).not.toHaveBeenCalled();
    expect(session.actions.exit).toHaveBeenCalledOnce();
  });

  it("uses safe restart/home when exiting report recovery", () => {
    const session = fakeSession({
      screen: "report",
      error: "报告获取失败",
    });
    mocks.useSession.mockReturnValue(session);
    render(<IeltsView />);

    fireEvent.click(screen.getByRole("button", { name: "退出" }));
    expect(session.actions.restart).toHaveBeenCalledOnce();
    expect(session.actions.exit).not.toHaveBeenCalled();
  });
});
