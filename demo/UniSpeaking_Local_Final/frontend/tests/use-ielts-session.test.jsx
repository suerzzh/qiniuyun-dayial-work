// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React, { StrictMode } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useIeltsSession } from "../src/hooks/useIeltsSession.js";

afterEach(cleanup);

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createFixture({ attemptId = "attempt-existing" } = {}) {
  const runtime = {
    stop: vi.fn(async () => {}),
    startAnswer: vi.fn(),
    getAttemptId: vi.fn(() => attemptId),
  };
  const api = {
    report: vi.fn(async (id) => ({ attempt_id: id, scoring_status: "COMPLETE" })),
    finalize: vi.fn(async () => {}),
    createAttempt: vi.fn(async () => ({ attempt_id: "attempt-new" })),
    abandon: vi.fn(async () => {}),
  };
  const streamer = { stop: vi.fn(async () => {}) };
  const controller = {
    getSnapshot: vi.fn(() => ({
      screen: "report",
      attemptId,
      report: { scoring_status: "FINALIZING" },
      error: null,
    })),
    dispose: vi.fn(() => runtime.stop()),
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
  };
  runtime.abandon = vi.fn(async () => {
    await api.abandon(runtime.getAttemptId());
  });

  const options = {
    createApi: vi.fn(() => api),
    createStreamer: vi.fn(() => streamer),
    createRuntime: vi.fn(() => runtime),
    createController: vi.fn((dependencies) => {
      controller.publish = dependencies.onChange;
      return controller;
    }),
    checkHealth: vi.fn(async () => ({ status: "UP" })),
  };

  return { api, controller, options, runtime, streamer };
}

describe("useIeltsSession resource ownership", () => {
  it("disposes the single controller/runtime ownership chain exactly once", async () => {
    const fixture = createFixture();
    const wrapper = ({ children }) => <StrictMode>{children}</StrictMode>;
    const rendered = renderHook(() => useIeltsSession(fixture.options), { wrapper });

    rendered.unmount();
    rendered.unmount();

    await waitFor(() => {
      expect(fixture.runtime.stop).toHaveBeenCalledTimes(1);
      expect(fixture.controller.dispose).toHaveBeenCalledTimes(1);
    });
    expect(fixture.options.createApi).toHaveBeenCalledTimes(1);
    expect(fixture.options.createStreamer).toHaveBeenCalledTimes(1);
    expect(fixture.options.createRuntime).toHaveBeenCalledTimes(1);
    expect(fixture.options.createController).toHaveBeenCalledTimes(1);
    expect(fixture.options.checkHealth).toHaveBeenCalledTimes(1);
  });

  it("retries the report for the existing attempt without creating or finalizing", async () => {
    const fixture = createFixture();
    const { result } = renderHook(() => useIeltsSession(fixture.options));

    await act(async () => {
      await result.current.actions.retryReport();
    });

    expect(fixture.api.report).toHaveBeenCalledWith("attempt-existing");
    expect(fixture.api.finalize).not.toHaveBeenCalled();
    expect(fixture.api.createAttempt).not.toHaveBeenCalled();
    expect(result.current.snapshot.report).toEqual({
      attempt_id: "attempt-existing",
      scoring_status: "COMPLETE",
    });
  });

  it("maps safe health capability flags to Chinese messages without exposing values", async () => {
    const fixture = createFixture();
    fixture.options.mediaDevices = { getUserMedia: vi.fn() };
    fixture.options.checkHealth.mockResolvedValue({
      java: true,
      qwenRealtimeConfigured: false,
      qwenScoringConfigured: true,
      xfyunConfigured: false,
      leakedValue: "secret-provider-value",
    });
    const { result } = renderHook(() => useIeltsSession(fixture.options));

    await waitFor(() => expect(result.current.serviceHealth.status).toBe("degraded"));

    expect(result.current.serviceHealth.service).toBe("ready");
    expect(result.current.serviceHealth.microphone).toBe("ready");
    expect(result.current.serviceHealth.messages.join(" ")).toMatch(/实时考官服务未配置/);
    expect(result.current.serviceHealth.messages.join(" ")).toMatch(/发音评估服务未配置/);
    expect(result.current.serviceHealth.messages.join(" ")).not.toContain("secret-provider-value");
  });

  it("starts each candidate answer once when its answer timer becomes active", () => {
    const fixture = createFixture();
    renderHook(() => useIeltsSession(fixture.options));
    const answering = {
      screen: "session",
      error: null,
      exam: {
        status: "part1_answering",
        currentPart: "part1",
        currentItemIndex: 0,
        attemptNo: 1,
      },
      timer: { kind: "part1_answer", remainingSeconds: 30 },
    };

    act(() => fixture.controller.publish(answering));
    act(() => fixture.controller.publish({ ...answering, timer: { ...answering.timer, remainingSeconds: 29 } }));
    expect(fixture.runtime.startAnswer).toHaveBeenCalledTimes(1);

    act(() => fixture.controller.publish({
      ...answering,
      exam: { ...answering.exam, currentItemIndex: 1 },
    }));
    expect(fixture.runtime.startAnswer).toHaveBeenCalledTimes(2);
  });

  it("shares one in-flight controller start across repeated start actions", async () => {
    const fixture = createFixture();
    const pendingStart = deferred();
    fixture.controller.start.mockReturnValue(pendingStart.promise);
    const { result } = renderHook(() => useIeltsSession(fixture.options));

    let first;
    let second;
    act(() => {
      first = result.current.actions.start();
      second = result.current.actions.start();
    });

    expect(first).toBe(second);
    expect(fixture.controller.start).toHaveBeenCalledTimes(1);

    pendingStart.resolve("started");
    await act(async () => expect(await first).toBe("started"));
  });

  it("tears down again after an unresolved start settles following unmount", async () => {
    const fixture = createFixture();
    const pendingStart = deferred();
    fixture.controller.start.mockReturnValue(pendingStart.promise);
    const rendered = renderHook(() => useIeltsSession(fixture.options));

    let starting;
    act(() => { starting = rendered.result.current.actions.start(); });
    rendered.unmount();

    await waitFor(() => {
      expect(fixture.controller.dispose).toHaveBeenCalledTimes(1);
      expect(fixture.runtime.stop).toHaveBeenCalledTimes(1);
    });
    expect(fixture.runtime.abandon).not.toHaveBeenCalled();

    pendingStart.resolve("started-after-unmount");
    await starting;

    await waitFor(() => {
      expect(fixture.runtime.abandon).toHaveBeenCalledTimes(1);
      expect(fixture.runtime.stop).toHaveBeenCalledTimes(2);
    });
    expect(fixture.api.abandon).toHaveBeenCalledWith("attempt-existing");
  });

  it("awaits old Attempt and transport teardown before returning home", async () => {
    const fixture = createFixture();
    const teardown = deferred();
    fixture.runtime.abandon.mockImplementation(async () => {
      await fixture.api.abandon("attempt-existing");
      await teardown.promise;
    });
    const { result } = renderHook(() => useIeltsSession(fixture.options));

    let restarting;
    act(() => { restarting = result.current.actions.restart(); });

    expect(fixture.api.abandon).toHaveBeenCalledWith("attempt-existing");
    expect(fixture.controller.restart).not.toHaveBeenCalled();

    teardown.resolve();
    await act(async () => { await restarting; });

    expect(fixture.runtime.stop).toHaveBeenCalledTimes(1);
    expect(fixture.controller.restart).toHaveBeenCalledTimes(1);
    expect(fixture.controller.restart.mock.invocationCallOrder[0])
      .toBeGreaterThan(fixture.runtime.stop.mock.invocationCallOrder[0]);
  });

  it("does not publish a report continuation after unmount cleanup begins", async () => {
    const fixture = createFixture();
    const pendingReport = deferred();
    const reportWasRead = vi.fn();
    fixture.api.report.mockReturnValue(pendingReport.promise);
    const rendered = renderHook(() => useIeltsSession(fixture.options));

    let retrying;
    act(() => { retrying = rendered.result.current.actions.retryReport(); });
    expect(rendered.result.current.snapshot.loading).toBe(true);

    pendingReport.resolve({
      attempt_id: "attempt-existing",
      get scoring_status() {
        reportWasRead();
        return "COMPLETE";
      },
    });
    rendered.unmount();
    await retrying;

    expect(reportWasRead).not.toHaveBeenCalled();
  });

  it("invalidates an older report continuation when safe restart returns home", async () => {
    const fixture = createFixture();
    const pendingReport = deferred();
    const reportWasRead = vi.fn();
    fixture.api.report.mockReturnValue(pendingReport.promise);
    const { result } = renderHook(() => useIeltsSession(fixture.options));

    let retrying;
    act(() => { retrying = result.current.actions.retryReport(); });
    await act(async () => { await result.current.actions.restart(); });

    await act(async () => {
      pendingReport.resolve({
        attempt_id: "attempt-existing",
        get scoring_status() {
          reportWasRead();
          return "COMPLETE";
        },
      });
      await retrying;
    });

    expect(reportWasRead).not.toHaveBeenCalled();
  });
});
