import React, { useEffect, useState } from "react";
import PageHeading from "../components/PageHeading";
import Icon from "../components/Icon";

export default function CustomSceneView({ mode, state, updateState }) {
  const prompt = state.customSceneConfig?.prompt || "机场退票改签沟通";
  const difficulty = state.customSceneConfig?.difficulty || 3;
  const duration = state.customSceneConfig?.duration || 8;
  const requirements = state.customSceneConfig?.requirements || "无";

  // Mode: generating - sequential logs loading
  const [activeLogs, setActiveLogs] = useState({ 1: true, 2: false, 3: false, 4: false });

  useEffect(() => {
    if (mode === "generating") {
      setActiveLogs({ 1: true, 2: false, 3: false, 4: false });
      const t2 = setTimeout(() => setActiveLogs((prev) => ({ ...prev, 2: true })), 500);
      const t3 = setTimeout(() => setActiveLogs((prev) => ({ ...prev, 3: true })), 1000);
      const t4 = setTimeout(() => setActiveLogs((prev) => ({ ...prev, 4: true })), 1500);
      const tRedirect = setTimeout(() => {
        window.location.hash = "#/custom-scene/preview";
      }, 2200);

      return () => {
        clearTimeout(t2);
        clearTimeout(t3);
        clearTimeout(t4);
        clearTimeout(tRedirect);
      };
    }
  }, [mode]);

  if (mode === "generating") {
    return (
      <section className="standard-page custom-generating-page view-enter">
        <div className="generating-wrapper panel">
          <div className="generating-orb">
            <span className="orb-core"></span>
            <span className="orb-ring ring-a"></span>
            <span className="orb-ring ring-b"></span>
            <span className="orb-logo">AI</span>
          </div>
          <h2>AI 正在为您生成专属训练路径</h2>
          <p className="generating-prompt">“{prompt}”</p>
          
          <div className="generating-steps-log">
            <div className={`log-line ${activeLogs[1] ? "active" : ""}`} id="log-step-1">
              <i></i><span>分析情景主题与沟通目标...</span>
            </div>
            <div className={`log-line ${activeLogs[2] ? "active" : ""}`} id="log-step-2">
              <i></i><span>设定 AI 伴侣角色及说话风格...</span>
            </div>
            <div className={`log-line ${activeLogs[3] ? "active" : ""}`} id="log-step-3">
              <i></i><span>生成常用核心词汇与句型清单...</span>
            </div>
            <div className={`log-line ${activeLogs[4] ? "active" : ""}`} id="log-step-4">
              <i></i><span>规划三步式能力训练序列...</span>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Mode: preview - character setup determination
  let charName = "Clara";
  let charTitle = "AI 沟通伴侣";
  let charDesc = "温和耐心的日常口语陪练，会根据您的反应调整难度。";
  let targetGoals = [
    "说明您的真实意图或当前面临的突发情况",
    "听懂 AI 的确认性提问，并礼貌给出回应",
    "运用至少 2 个推荐的核心短语完成沟通"
  ];
  let vocabList = [
    { text: "alternative", phonetic: "/ɔːlˈtɜːnətɪv/", trans: "替代选择；替代方案" },
    { text: "confirm", phonetic: "/kənˈfɜːm/", trans: "确认；核实" },
    { text: "appreciate", phonetic: "/əˈpriːʃieɪt/", trans: "感激；感谢" }
  ];

  if (prompt.includes("面试") || prompt.includes("工作") || prompt.includes("产品")) {
    charName = "Mark";
    charTitle = "英文面试官";
    charDesc = "专业严谨的职场面试官，发音标准，会针对您的回答进行细节追问。";
    vocabList = [
      { text: "experience", phonetic: "/ɪkˈspɪəriəns/", trans: "经历；经验" },
      { text: "contribution", phonetic: "/ˌkɒntrɪˈbjuːʃn/", trans: "贡献" },
      { text: "collaborate", phonetic: "/kə\u00e6b\u0259re\u026at/", trans: "合作；协作" }
    ];
  } else if (prompt.includes("机场") || prompt.includes("机票") || prompt.includes("旅行") || prompt.includes("酒店")) {
    charName = "Sarah";
    charTitle = "机场值机经理";
    charDesc = "高效耐心的机场前台，熟悉退改签政策和行李处理规则。";
    vocabList = [
      { text: "rebook", phonetic: "/\u02ccri\u02d0\u02d0b\u028ak/", trans: "重新预订（机票等）" },
      { text: "baggage allowance", phonetic: "/\u02c8b\u00e6\u0261\u026ad\u0292/", trans: "免费行李额度" },
      { text: "compensation", phonetic: "/\u02cck\u0252mpen\u02c8se\u026a\u0283n/", trans: "补偿；赔偿金" }
    ];
  }

  const levelLabels = ["A1", "A2", "B1", "B2", "C1", "C2"];
  const levelText = levelLabels[difficulty - 1] || "B1";

  const handleRegenerate = () => {
    window.location.hash = "#/custom-scene/generating";
  };

  return (
    <section className="standard-page custom-preview-page view-enter">
      <PageHeading
        eyebrow="AI Generated Scene / Preview"
        title="专属场景已生成"
        description="我们为您定制了以下沟通角色和词汇清单，点击开始即可进入练习。"
      />

      <div className="preview-layout">
        {/* Main Scene Card */}
        <div className="scene-preview-card panel">
          <header className="scene-preview-header">
            <div className="scene-badge">AI 定制场景</div>
            <h1>{prompt}</h1>
            <div className="scene-meta-row">
              <span>
                难度级别：<strong>CEFR {levelText}</strong>
              </span>
              <span>
                建议用时：<strong>{duration} 分钟</strong>
              </span>
            </div>
          </header>

          <section className="character-profile">
            <h3>👤 伴侣角色设定</h3>
            <div className="character-box">
              <span className="char-avatar">{charName[0]}</span>
              <div>
                <strong>
                  {charName} <small>· {charTitle}</small>
                </strong>
                <p>{charDesc}</p>
              </div>
            </div>
          </section>

          <section className="task-goals">
            <h3>🎯 场景训练目标</h3>
            <ul>
              {targetGoals.map((goal, index) => (
                <li key={index}>
                  <i></i>
                  <span>{goal}</span>
                </li>
              ))}
            </ul>
          </section>

          {requirements && requirements !== "无" && (
            <section className="special-reqs">
              <h3>📝 附加要求</h3>
              <p>{requirements}</p>
            </section>
          )}

          <footer className="preview-foot">
            <button className="outline-btn" type="button" onClick={handleRegenerate}>
              重新生成
            </button>
            <a className="primary-btn" href="#/training/cafe/words">
              开始定制训练 <Icon name="arrow" />
            </a>
          </footer>
        </div>

        {/* Generated vocab list panel */}
        <div className="vocab-preview-panel panel">
          <h2>📚 推荐核心表达 (Vocabulary & Phrases)</h2>
          <p className="section-desc">建议在正式模拟中尝试使用以下表达：</p>
          <div className="vocab-preview-list">
            {vocabList.map((vocab) => (
              <article className="vocab-preview-item" key={vocab.text}>
                <div className="item-head">
                  <strong>{vocab.text}</strong>
                  <span className="phonetic">{vocab.phonetic}</span>
                </div>
                <p className="trans">{vocab.trans}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
