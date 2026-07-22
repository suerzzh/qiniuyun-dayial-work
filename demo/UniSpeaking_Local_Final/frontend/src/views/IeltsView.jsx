// @ts-nocheck

import React from "react";
import IeltsExamStage from "../components/ielts/IeltsExamStage.jsx";
import IeltsHome from "../components/ielts/IeltsHome.jsx";
import IeltsPreflight from "../components/ielts/IeltsPreflight.jsx";
import IeltsReportView from "../components/ielts/IeltsReportView.jsx";
import { useIeltsSession } from "../hooks/useIeltsSession.js";

function retryForScreen(screen, actions) {
  if (screen === "report") return actions.retryReport;
  if (screen === "session") return actions.retry;
  if (screen === "preflight") return actions.start;
  return actions.restart;
}

export default function IeltsView() {
  const { snapshot, actions, serviceHealth } = useIeltsSession();

  if (snapshot.loading || snapshot.error) {
    const retry = retryForScreen(snapshot.screen, actions);
    return (
      <main className="ielts-recovery-state">
        {snapshot.error ? (
          <div role="alert">
            <h1>暂时无法继续</h1>
            <p>{snapshot.error}</p>
          </div>
        ) : (
          <div role="status">
            <h1>正在准备 IELTS 口语测试…</h1>
            <p>请稍候，不要关闭当前页面。</p>
          </div>
        )}
        <div>
          <button type="button" onClick={() => void retry()}>重试</button>
          <button type="button" onClick={actions.exit}>退出</button>
        </div>
      </main>
    );
  }

  switch (snapshot.screen) {
    case "home":
      return <IeltsHome onSelectMode={actions.selectMode} />;
    case "preflight":
      return (
        <IeltsPreflight
          selection={snapshot.selection}
          preflight={snapshot.preflight}
          serviceHealth={serviceHealth}
          onChange={actions.setPreflight}
          onStart={actions.start}
          onExit={actions.exit}
        />
      );
    case "session":
      return (
        <IeltsExamStage
          snapshot={snapshot}
          onSubmitAnswer={actions.submitAnswer}
          onUpdateNotes={actions.updateNotes}
          onToggleCaptions={actions.toggleCaptions}
          onRetry={actions.retry}
          onNext={actions.next}
          onExit={actions.exit}
        />
      );
    case "report":
      return (
        <IeltsReportView
          report={snapshot.report}
          onRestart={actions.restart}
          onRetry={actions.retryReport}
        />
      );
    default:
      return (
        <main className="ielts-recovery-state" role="alert">
          <h1>无法识别当前测试状态</h1>
          <button type="button" onClick={actions.restart}>返回 IELTS 首页</button>
        </main>
      );
  }
}
