import React from "react";
import Icon from "../components/Icon";
import StageProgress from "../components/StageProgress";
import VoiceOrb from "../components/VoiceOrb";
import { learningAssets, sentences, diagnosticDimensions } from "../data";
import RestaurantSimulationSession from "./RestaurantSimulationSession";

export default function TrainingView({ stage, scene, state, updateState, showToast }) {
  const isRestaurantDemo = scene === "restaurant" && stage === "simulation";
  const activeAssetIndex = Math.min(state.activeAsset || 0, learningAssets.length - 1);
  const activeWord = learningAssets[activeAssetIndex];

  const activeSentenceIndex = Math.min(state.activeAsset || 0, sentences.length - 1);
  const activeSentence = sentences[activeSentenceIndex];
  const currentSentenceScore = state.sentenceScores?.[activeSentenceIndex];

  // Helper: Head header
  const renderTrainingHead = () => (
    <header className="training-head">
      <div>
        <h1>{isRestaurantDemo ? "餐厅特殊需求" : "咖啡店点单"}</h1>
        <p>
          {isRestaurantDemo
            ? "和 Clara 店员进行儿童餐厅点餐对话，练习食物、饮料与礼貌表达。"
            : state.isDirectSimulation
            ? "直接开始真实场景模拟对话，练习地道表达与应答。"
            : "从词语到完整表达，最后进入真实场景模拟。"}
        </p>
      </div>
      <a
        className="exit-training-btn"
        href={isRestaurantDemo ? "#/scenes" : state.isDirectSimulation ? `#/review/${scene || "cafe"}` : "#/scenes"}
      >
        退出训练
      </a>
    </header>
  );

  // Helper: Audio Play Toggle
  const handlePlayToggle = (id) => {
    updateState({ playingId: state.playingId === id ? "" : id });
  };

  // Helper: Words View
  const renderWords = () => {
    return (
      <div className="learning-layout">
        <aside className="asset-queue training-sidebar panel">
          <div className="queue-head training-sidebar-head">
            <span>本组词语</span>
            <span>{activeAssetIndex + 1} / {learningAssets.length}</span>
          </div>
          {learningAssets.map((item, index) => {
            const isDone = index < activeAssetIndex;
            return (
              <button
                key={item.id}
                className={`queue-item ${index === activeAssetIndex ? "active" : ""}`}
                type="button"
                onClick={() => updateState({ activeAsset: index, recording: false, playingId: "" })}
              >
                <span>{item.type}</span>
                <strong>{item.text}</strong>
                <i className={isDone ? "is-done" : ""}>
                  {isDone ? <Icon name="check" /> : index + 1}
                </i>
              </button>
            );
          })}
        </aside>
        
        <section className="learning-card is-passive panel">
          <div className="learning-type">
            <span>{activeWord.type}</span>
            <small>重点表达</small>
          </div>
          
          <div className="learning-copy">
            <div className="word-title-row">
              <h2>{activeWord.text}</h2>
            </div>
            <p className="phonetic">
              <span>{activeWord.phonetic}</span>
              <button
                className={`word-audio-btn ${state.playingId === activeWord.id ? "active" : ""}`}
                type="button"
                onClick={() => handlePlayToggle(activeWord.id)}
                aria-label={`播放 ${activeWord.text} 的原音`}
              >
                <Icon name={state.playingId === activeWord.id ? "pause" : "volume"} />
              </button>
            </p>
            <p className="translation">{activeWord.translation}</p>
          </div>
          
          <footer className="learning-foot">
            <button
              className="outline-btn"
              type="button"
              disabled={activeAssetIndex === 0}
              onClick={() => updateState({ activeAsset: activeAssetIndex - 1, recording: false, playingId: "" })}
            >
              上一个
            </button>
            {activeAssetIndex === learningAssets.length - 1 ? (
              <button
                className="primary-btn"
                type="button"
                onClick={() => {
                  updateState({ activeAsset: 0, recording: false, playingId: "", activeEval: null });
                  window.location.hash = "#/training/cafe/sentences";
                }}
              >
                下一个 <Icon name="arrow" />
              </button>
            ) : (
              <button
                className="primary-btn"
                type="button"
                onClick={() => updateState({ activeAsset: activeAssetIndex + 1, recording: false, playingId: "" })}
              >
                下一个 <Icon name="arrow" />
              </button>
            )}
          </footer>
        </section>
      </div>
    );
  };

  // Helper: Sentence Recording & Eval
  const handleSentenceVoiceOrbClick = () => {
    const isRecording = !state.recording;
    if (isRecording) {
      updateState({ recording: true });
    } else {
      const attempts = state.attempts || {};
      const currentAttempts = attempts[activeSentenceIndex] || 0;
      const nextAttempts = currentAttempts + 1;
      attempts[activeSentenceIndex] = nextAttempts;

      const score = nextAttempts === 1 ? 76 : 89;
      const sentenceText = sentences[activeSentenceIndex].text;
      let highlightedMarkup = "";

      if (score < 80) {
        if (activeSentenceIndex === 0) highlightedMarkup = 'Could you <span class="word-error">recommend</span> something less sweet?';
        else if (activeSentenceIndex === 1) highlightedMarkup = 'I feel <span class="word-error">like trying</span> something different today.';
        else if (activeSentenceIndex === 2) highlightedMarkup = 'I’ll have a medium <span class="word-error">latte</span> with oat milk.';
        else highlightedMarkup = 'That’s all, <span class="word-error">thank</span> you.';
      } else {
        highlightedMarkup = `<span class="word-correct">${sentenceText}</span>`;
      }

      updateState({
        recording: false,
        attempts,
        activeEval: {
          score,
          highlightedMarkup
        }
      });
      showToast(score >= 80 ? "跟读评估完成，成绩达标！" : "发音有微小错误，分数未达标");
    }
  };

  const handleCloseEvalModal = () => {
    const sentenceScores = state.sentenceScores || {};
    if (state.activeEval && state.activeEval.score >= 80) {
      sentenceScores[activeSentenceIndex] = state.activeEval.score;
    }
    updateState({
      activeEval: null,
      sentenceScores
    });
  };

  const renderSentences = () => {
    const currentSentencePassed = (state.sentenceScores?.[activeSentenceIndex] || 0) >= 80;
    const allSentencesPassed = sentences.every((_, idx) => (state.sentenceScores?.[idx] || 0) >= 80);

    return (
      <div className="learning-layout">
        <aside className="sentence-list training-sidebar panel">
          <div className="queue-head training-sidebar-head">
            <span>完整表达</span>
            <span>{activeSentenceIndex + 1} / {sentences.length}</span>
          </div>
          {sentences.map((sentence, index) => {
            const isDone = index < activeSentenceIndex || !!state.sentenceScores?.[index];
            return (
              <button
                key={index}
                className={`queue-item ${index === activeSentenceIndex ? "active" : ""}`}
                type="button"
                onClick={() => updateState({ activeAsset: index, recording: false, playingId: "", activeEval: null })}
              >
                <span>句子</span>
                <strong>{sentence.text}</strong>
                <i className={isDone ? "is-done" : ""}>
                  {isDone ? <Icon name="check" /> : index + 1}
                </i>
              </button>
            );
          })}
        </aside>

        <section className="sentence-stage panel">
          <span className="sentence-index">{activeSentenceIndex + 1} / {sentences.length}</span>
          <button
            className={`word-audio-btn ${state.playingId === `sentence-${activeSentenceIndex}` ? "active" : ""}`}
            type="button"
            onClick={() => handlePlayToggle(`sentence-${activeSentenceIndex}`)}
            aria-label="听句子"
          >
            <Icon name={state.playingId === `sentence-${activeSentenceIndex}` ? "pause" : "volume"} />
          </button>
          
          <h2>{activeSentence.text}</h2>
          <p className="sentence-cn">{activeSentence.translation}</p>
          
          <div className="rhythm-guide">
            <span>节奏重点</span>
            <strong>{activeSentence.focus}</strong>
          </div>
          
          <div className="sentence-record is-centered">
            <VoiceOrb
              state={state.recording ? "listening" : "ready"}
              label="开始句子跟读"
              onClick={handleSentenceVoiceOrbClick}
            />
            <div>
              <h3>
                {state.recording
                  ? "再次点击完成录音"
                  : currentSentenceScore
                  ? `本句已通过 · ${currentSentenceScore} 分`
                  : "轮到你说"}
              </h3>
              <p>尽量完整、连贯地说出整句话。</p>
            </div>
          </div>
          
          <footer className="learning-foot">
            <button
              className="outline-btn"
              type="button"
              onClick={() => {
                updateState({ activeAsset: 0, recording: false, playingId: "", activeEval: null });
                window.location.hash = "#/training/cafe/words";
              }}
            >
              上一个
            </button>
            {activeSentenceIndex === sentences.length - 1 ? (
              <button
                className="primary-btn"
                type="button"
                disabled={!allSentencesPassed}
                onClick={() => {
                  updateState({ activeAsset: 0, recording: false, playingId: "", activeEval: null });
                  window.location.hash = "#/training/cafe/simulation";
                }}
              >
                下一个 <Icon name="arrow" />
              </button>
            ) : (
              <button
                className="primary-btn"
                type="button"
                disabled={!currentSentencePassed}
                onClick={() => updateState({ activeAsset: activeSentenceIndex + 1, recording: false, playingId: "" })}
              >
                下一个 <Icon name="arrow" />
              </button>
            )}
          </footer>
        </section>

        {state.activeEval && (
          <div className="eval-overlay" role="dialog" aria-modal="true" aria-labelledby="eval-title">
            <div className="eval-card panel">
              <div className="eval-score">
                {state.activeEval.score}<small>/100</small>
              </div>
              <div className="eval-header">
                <h2 id="eval-title">本句发音评估</h2>
                <p className="eval-desc">
                  {state.activeEval.score >= 80 ? "表达清楚，节奏自然。" : "再留意标记部分的重音与连读。"}
                </p>
              </div>
              <div className="eval-analysis">
                <p className="analysis-title">发音定位</p>
                <div
                  className="analysis-comparison"
                  dangerouslySetInnerHTML={{ __html: state.activeEval.highlightedMarkup }}
                ></div>
              </div>
              <div className="eval-actions">
                <button className="primary-btn" type="button" onClick={handleCloseEvalModal}>
                  知道了
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Helper: Radar / Score Modal
  const renderScoreModal = () => {
    return (
      <div className="score-modal" role="dialog" aria-modal="true" aria-labelledby="score-title" aria-describedby="score-desc">
        <div className="score-modal-card panel">
          <header className="score-modal-head">
            <div>
              <p className="eyebrow">Simulation complete</p>
              <h2 id="score-title">模拟完成，来看看这次的表现</h2>
              <p id="score-desc">你顺利完成了点单、偏好说明与确认。下一次重点让连接词更自然。</p>
            </div>
            <div className="score-total"><strong>84</strong><span>/100</span></div>
          </header>
          
          <div className="score-modal-body">
            <div className="radar-wrap">
              <div className="radar-chart" role="img" aria-label="五维评分雷达图：发音清晰度84分，流利度78分，表达完整度91分，互动回应86分，自然度80分">
                <i className="radar-ring radar-ring-1"></i>
                <i className="radar-ring radar-ring-2"></i>
                <i className="radar-ring radar-ring-3"></i>
                <i className="radar-ring radar-ring-4"></i>
                <i className="radar-ring radar-ring-5"></i>
                <i className="radar-spoke spoke-1"></i>
                <i className="radar-spoke spoke-2"></i>
                <i className="radar-spoke spoke-3"></i>
                <i className="radar-spoke spoke-4"></i>
                <i className="radar-spoke spoke-5"></i>
                <span className="radar-shape"></span>
                <b className="radar-label label-1">发音清晰度<em>84</em></b>
                <b className="radar-label label-2">流利度<em>78</em></b>
                <b className="radar-label label-3">表达完整度<em>91</em></b>
                <b className="radar-label label-4">互动回应<em>86</em></b>
                <b className="radar-label label-5">自然度<em>80</em></b>
              </div>
            </div>
            <div className="score-insights">
              <p className="eyebrow">五维表现</p>
              <h3>表达完整，互动自然</h3>
              <p>你能主动确认饮品信息，也清楚说明了甜度与奶类偏好。</p>
              <div className="score-dimension-list">
                {diagnosticDimensions.map((item, index) => (
                  <div key={index}>
                    <span>{item.name}</span>
                    <strong>{item.value}</strong>
                    <small>{item.note}</small>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <footer className="score-modal-actions">
            <a className="outline-btn" href="#/scenes">返回场景广场</a>
            <a className="primary-btn" href="#/review/cafe">
              查看学习资产 <Icon name="arrow" />
            </a>
          </footer>
        </div>
      </div>
    );
  };

  // Helper: Simulation View
  const renderSimulation = () => {
    return (
      <section className="simulation-shell is-full panel">
        <div className="simulation-stage">
          <div className="simulation-transcript">
            <div className="turn"><span>Barista</span><p>Hi! What can I get started for you today?</p></div>
            <div className="turn you"><span>You</span><p>Could you recommend something less sweet?</p></div>
            <div className="turn"><span>Barista</span><p>Sure — how about a medium oat milk latte?</p></div>
            <div className="turn you live"><span>You</span><p>I’ll have that, thank you.</p></div>
          </div>
          
          <div className="simulation-voice is-centered">
            <VoiceOrb
              state={state.voiceState === "listening" ? "listening" : "ready"}
              label="继续模拟对话"
              onClick={() => updateState({ voiceState: state.voiceState === "listening" ? "ready" : "listening" })}
            />
            <div>
              <strong>{state.voiceState === "listening" ? "正在听你说…" : "继续回应店员"}</strong>
              <span>保持自然，不用追求逐字完美。</span>
            </div>
          </div>
          
          <div className="simulation-actions">
            <button className="outline-btn" type="button" onClick={() => updateState({ showSimulationTips: true })}>
              需要提示
            </button>
            <button
              className="primary-btn"
              type="button"
              onClick={() => updateState({ recording: false, playingId: "", activeEval: null, showSimulationTips: false, scoreModalOpen: true })}
            >
              结束模拟
            </button>
          </div>
        </div>

        {state.showSimulationTips && (
          <div className="eval-overlay" role="dialog" aria-modal="true" aria-labelledby="simulation-tip-title">
            <div className="eval-card simulation-tip-card panel">
              <div className="eval-header">
                <p className="eyebrow">Your mission</p>
                <h2 id="simulation-tip-title">完成这次点单，可以从三件事入手</h2>
              </div>
              <ul className="simulation-tip-list">
                <li><span>01</span><div><strong>选择饮品和杯型</strong><small>例如 medium latte</small></div></li>
                <li><span>02</span><div><strong>说明甜度和奶类偏好</strong><small>例如 less sweet、with oat milk</small></div></li>
                <li><span>03</span><div><strong>听懂追问并确认订单</strong><small>不必逐字使用练习句，自然回应即可</small></div></li>
              </ul>
              <div className="simulation-tip-example">
                <span>参考表达</span>
                <strong>I’ll have a medium latte with oat milk, please.</strong>
              </div>
              <div className="eval-actions">
                <button className="primary-btn" type="button" onClick={() => updateState({ showSimulationTips: false })}>
                  继续模拟
                </button>
              </div>
            </div>
          </div>
        )}

        {state.scoreModalOpen && renderScoreModal()}
      </section>
    );
  };

  const currentContent =
    isRestaurantDemo
      ? <RestaurantSimulationSession />
      : stage === "sentences"
      ? renderSentences()
      : stage === "simulation"
      ? renderSimulation()
      : renderWords();

  return (
    <section className="training-page view-enter">
      {renderTrainingHead()}
      {!state.isDirectSimulation && !isRestaurantDemo && (
        <StageProgress current={stage} maxStage={state.maxStage || "words"} />
      )}
      {currentContent}
    </section>
  );
}
