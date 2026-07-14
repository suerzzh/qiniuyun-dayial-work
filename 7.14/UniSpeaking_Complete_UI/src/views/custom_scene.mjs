import { pageHeading, icon } from "../components.mjs";

export function renderCustomSceneGenerating(state) {
  const prompt = state.customSceneConfig?.prompt || "英文面试";
  return `<section class="standard-page custom-generating-page view-enter">
    <div class="generating-wrapper panel">
      <div class="generating-orb">
        <span class="orb-core"></span>
        <span class="orb-ring ring-a"></span>
        <span class="orb-ring ring-b"></span>
        <span class="orb-logo">AI</span>
      </div>
      <h2>AI 正在为您生成专属训练路径</h2>
      <p class="generating-prompt">“${prompt}”</p>
      
      <div class="generating-steps-log">
        <div class="log-line active" id="log-step-1"><i></i><span>分析情景主题与沟通目标...</span></div>
        <div class="log-line" id="log-step-2"><i></i><span>设定 AI 伴侣角色及说话风格...</span></div>
        <div class="log-line" id="log-step-3"><i></i><span>生成常用核心词汇与句型清单...</span></div>
        <div class="log-line" id="log-step-4"><i></i><span>规划三步式能力训练序列...</span></div>
      </div>
    </div>
  </section>`;
}

export function renderCustomScenePreview(state) {
  const prompt = state.customSceneConfig?.prompt || "机场退票改签沟通";
  const difficulty = state.customSceneConfig?.difficulty || 3;
  const duration = state.customSceneConfig?.duration || 8;
  const requirements = state.customSceneConfig?.requirements || "无";

  // Dynamic character determination based on prompt keywords to make it look intelligent
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
      { text: "collaborate", phonetic: "/kəˈlæbəreɪt/", trans: "合作；协作" }
    ];
  } else if (prompt.includes("机场") || prompt.includes("机票") || prompt.includes("旅行") || prompt.includes("酒店")) {
    charName = "Sarah";
    charTitle = "机场值机经理";
    charDesc = "高效耐心的机场前台，熟悉退改签政策和行李处理规则。";
    vocabList = [
      { text: "rebook", phonetic: "/ˌriːˈbʊk/", trans: "重新预订（机票等）" },
      { text: "baggage allowance", phonetic: "/ˈbæɡɪdʒ/", trans: "免费行李额度" },
      { text: "compensation", phonetic: "/ˌkɒmpenˈseɪʃn/", trans: "补偿；赔偿金" }
    ];
  }

  const levelLabels = ["A1", "A2", "B1", "B2", "C1", "C2"];
  const levelText = levelLabels[difficulty - 1] || "B1";

  return `<section class="standard-page custom-preview-page view-enter">
    ${pageHeading("AI Generated Scene / Preview", "专属场景已生成", "我们为您定制了以下沟通角色和词汇清单，点击开始即可进入练习。")}

    <div class="preview-layout">
      <!-- Main Scene Card -->
      <div class="scene-preview-card panel">
        <header class="scene-preview-header">
          <div class="scene-badge">AI 定制场景</div>
          <h1>${prompt}</h1>
          <div class="scene-meta-row">
            <span>难度级别：<strong>CEFR ${levelText}</strong></span>
            <span>建议用时：<strong>${duration} 分钟</strong></span>
          </div>
        </header>

        <section class="character-profile">
          <h3>👤 伴侣角色设定</h3>
          <div class="character-box">
            <span class="char-avatar">${charName[0]}</span>
            <div>
              <strong>${charName} <small>· ${charTitle}</small></strong>
              <p>${charDesc}</p>
            </div>
          </div>
        </section>

        <section class="task-goals">
          <h3>🎯 场景训练目标</h3>
          <ul>
            ${targetGoals.map(goal => `<li><i></i><span>${goal}</span></li>`).join("")}
          </ul>
        </section>

        ${requirements && requirements !== "无" ? `
          <section class="special-reqs">
            <h3>📝 附加要求</h3>
            <p>${requirements}</p>
          </section>
        ` : ""}

        <footer class="preview-foot">
          <button class="outline-btn" type="button" data-action="regenerate-custom-scene">重新生成</button>
          <a class="primary-btn" href="#/training/cafe/words">开始定制训练 ${icon("arrow")}</a>
        </footer>
      </div>

      <!-- Generated vocab list panel -->
      <div class="vocab-preview-panel panel">
        <h2>📚 推荐核心表达 (Vocabulary & Phrases)</h2>
        <p class="section-desc">建议在正式模拟中尝试使用以下表达：</p>
        <div class="vocab-preview-list">
          ${vocabList.map(vocab => `
            <article class="vocab-preview-item">
              <div class="item-head">
                <strong>${vocab.text}</strong>
                <span class="phonetic">${vocab.phonetic}</span>
              </div>
              <p class="trans">${vocab.trans}</p>
            </article>
          `).join("")}
        </div>
      </div>
    </div>
  </section>`;
}
