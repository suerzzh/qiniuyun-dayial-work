import { CEFR_LEVELS, SPEED_META, WPM_VALUES, durationByDay, learningAssets, sceneCategories } from "../data.mjs";
import { icon, pageHeading, profileSidebar } from "../components.mjs";

function profileShell(active, content) {
  return `<section class="profile-page view-enter">${profileSidebar(active)}<div class="profile-content"><p class="content-label">${active === "overview" ? "个人概览" : active === "assets" ? "学习资产" : active === "scenes" ? "常用场景" : "助手设置"}</p>${content}</div></section>`;
}

function overview(state) {
  const total = durationByDay.reduce((sum,value)=>sum+value,0);
  const streak = state.hasCheckedIn ? 8 : 7;
  
  // Generating July 2026 Calendar Grid (July 1st is Wednesday)
  // Day offsets: Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6
  // July 1 is Wed, so 2 empty cells at start.
  const emptyCells = 2;
  const daysInJuly = 31;
  const todayDate = 13; // July 13th
  
  const calendarCells = [];
  for (let i = 0; i < emptyCells; i++) {
    calendarCells.push(`<div class="calendar-day empty"></div>`);
  }
  for (let day = 1; day <= daysInJuly; day++) {
    const isChecked = day < todayDate || (day === todayDate && state.hasCheckedIn);
    const isToday = day === todayDate;
    calendarCells.push(`
      <div class="calendar-day ${isChecked ? "checked" : ""} ${isToday ? "today" : ""}">
        <span>${day}</span>
        ${isChecked ? `<i></i>` : ""}
      </div>
    `);
  }

  // 5 Dimensions of Capability
  const capabilities = [
    { name: "发音清晰度 (Pronunciation)", value: 84, color: "#168f87" },
    { name: "流利度 (Fluency)", value: 78, color: "#e8462d" },
    { name: "词汇多样性 (Vocabulary)", value: 82, color: "#3d70e8" },
    { name: "语法正确度 (Grammar)", value: 75, color: "#e8a03d" },
    { name: "场景互动性 (Interaction)", value: 86, color: "#853de8" }
  ];

  // Achievements
  const achievements = [
    { title: "开口先锋", desc: "完成首次自由对话", icon: "🎙️", unlocked: true },
    { title: "坚持不懈", desc: "连续坚持学习 7 天", icon: "🔥", unlocked: true },
    { title: "常用场景通关", desc: "通过咖啡店模拟训练", icon: "☕", unlocked: true },
    { title: "更上层楼", desc: "单项诊断达 90 分以上", icon: "🏆", unlocked: false }
  ];

  return profileShell("overview", `<section class="profile-dashboard panel"><header><div><p class="eyebrow">Personal overview</p><h1>你的学习空间</h1><p>记录您的发音细节、打卡天数 and 能力倾向成长曲线。</p></div><span class="local-badge">本地演示数据</span></header>
    
    <div class="profile-stats">
      <article><span>${icon("clock")}</span><p>本周学习时长</p><strong>${total}<small>分钟</small></strong></article>
      <article><span>${icon("book")}</span><p>已保存学习资产</p><strong>${learningAssets.length}<small>项</small></strong></article>
      <article><span>${icon("bookmark")}</span><p>连续学习天数</p><strong>${streak}<small>天</small></strong></article>
    </div>

    <!-- Calendar & Check-in section -->
    <div class="calendar-card">
      <div class="calendar-info">
        <p class="eyebrow">Learning Calendar</p>
        <h2>7 月学习日历</h2>
        <div class="streak-box">
          <strong>${streak} <small>天</small></strong>
          <span>连续学习打卡</span>
        </div>
        <button class="primary-btn checkin-btn ${state.hasCheckedIn ? "done" : ""}" type="button" data-action="perform-check-in" ${state.hasCheckedIn ? "disabled" : ""}>
          ${state.hasCheckedIn ? `${icon("check")} 今日已打卡` : `${icon("plus")} 立即打卡`}
        </button>
      </div>
      
      <div class="calendar-grid-wrapper">
        <div class="calendar-weekdays">
          <span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span>
        </div>
        <div class="calendar-days-grid">
          ${calendarCells.join("")}
        </div>
      </div>
    </div>

    <!-- Capability Chart & Duration -->
    <div class="dashboard-double-columns">
      <div class="capability-panel">
        <p class="eyebrow">Skills Profile</p>
        <h2>五维能力诊断倾向</h2>
        <div class="capability-bars">
          ${capabilities.map(cap => `
            <div class="cap-bar-item">
              <div class="cap-label">
                <span>${cap.name}</span>
                <strong>${cap.value}%</strong>
              </div>
              <div class="cap-rail"><i style="width: ${cap.value}%; background: ${cap.color};"></i></div>
            </div>
          `).join("")}
        </div>
      </div>

      <div class="duration-card">
        <div>
          <p class="eyebrow">Learning duration</p>
          <h2>最近 7 天时长</h2>
          <p>观察练习节奏，不设置过多压力指标。</p>
        </div>
        <div class="duration-chart" aria-label="最近七天学习时长">
          ${durationByDay.map((value,index)=>`<div><i style="--height:${value/40*100}%"></i><span>${["四","五","六","日","一","二","三"][index]}</span><b>${value}m</b></div>`).join("")}
        </div>
      </div>
    </div>

    <!-- Achievements Wall -->
    <div class="achievements-section">
      <p class="eyebrow">Milestones</p>
      <h2>成就徽章墙</h2>
      <div class="achievements-grid">
        ${achievements.map(ach => `
          <div class="achievement-medal ${ach.unlocked ? "unlocked" : "locked"}">
            <span class="medal-icon">${ach.icon}</span>
            <div class="medal-copy">
              <strong>${ach.title}</strong>
              <small>${ach.desc}</small>
            </div>
            ${ach.unlocked ? `<span class="unlocked-badge">已解锁</span>` : `<span class="locked-badge">未解锁</span>`}
          </div>
        `).join("")}
      </div>
    </div>

    <div class="profile-shortcuts">
      <a href="#/profile/assets"><span>${icon("book")}</span><p><strong>学习资产</strong><small>查看单词、短语与句子</small></p>${icon("arrow")}</a>
      <a href="#/profile/scenes"><span>${icon("bookmark")}</span><p><strong>常用场景</strong><small>按真实情境分类</small></p>${icon("arrow")}</a>
      <a href="#/profile/settings"><span>${icon("gear")}</span><p><strong>助手设置</strong><small>调整语速与表达难度</small></p>${icon("arrow")}</a>
    </div>
  </section>`);
}

function assets() {
  return profileShell("assets", `<section class="profile-list-page panel">${pageHeading("Saved learning assets","学习资产","这些内容来自已完成训练，可进入复习区逐项跟读。",'<a class="primary-btn" href="#/review">进入复习</a>')}<div class="asset-library-grid">${learningAssets.map((item)=>`<article><span>${item.type}</span><h2>${item.text}</h2><p>${item.translation}</p><small>${item.note}</small><a href="#/review/cafe">查看与复练 ${icon("arrow")}</a></article>`).join("")}</div></section>`);
}

function scenes() {
  return profileShell("scenes", `<section class="profile-list-page panel">${pageHeading("Frequently used scenes","常用场景","按生活、校园、旅行和工作整理，下一次可以直接进入。",'<a class="primary-btn" href="#/scenes">打开场景广场</a>')}<div class="favorite-scene-grid">${sceneCategories.map((category)=>`<article><p class="eyebrow">${category.id}</p><h2>${category.label}</h2>${category.scenes.map((scene)=>`<a href="#/training/cafe/words"><span><strong>${scene.title}</strong><small>${scene.desc}</small></span>${icon("arrow")}</a>`).join("")}</article>`).join("")}</div></section>`);
}

function settings(state) {
  const speed = state.settings.speed;
  const difficulty = state.settings.difficulty;
  const speedProgress = (speed - 80) / 120 * 100;
  const level = CEFR_LEVELS[difficulty - 1];
  const speedMeta = SPEED_META[speed];
  return profileShell("settings", `<section class="settings-shell panel"><header class="settings-head"><div><p class="eyebrow">AI assistant</p><h1>AI 助手设置</h1><p>微调陪练节奏，让每一次开口更接近你的真实使用习惯。</p></div><div class="sync-state is-${state.saveStatus}"><i></i><span>${state.saveStatus==="dirty"?"等待保存":state.saveStatus==="saving"?"正在保存":state.saveStatus==="saved"?"刚刚已同步":"设置已同步"}</span></div></header><div class="settings-body">
    <section class="setting-row"><div><label for="speedRange">对话语速</label><p>以每分钟词数精确控制回复与示范节奏。</p><span class="standard-tag">WPM 量化速度</span></div><div class="range-zone" style="--progress:${speedProgress}%"><header><strong data-speed-label>${speedMeta[0]} · ${speed} WPM</strong><span data-speed-detail>${speedMeta[1]}</span></header><input id="speedRange" type="range" min="80" max="200" step="10" value="${speed}" data-setting="speed" aria-valuetext="${speedMeta[0]}，${speed} WPM"><div class="range-marks" aria-hidden="true">${WPM_VALUES.map((value)=>`<i class="${value<=speed?"passed":""} ${value===speed?"current":""}"></i>`).join("")}</div><div class="range-edge"><span>80 · 入门</span><b>${speed} · ${speedMeta[0]}</b><span>200 · 挑战</span></div></div></section>
    <section class="setting-row"><div><label for="difficultyRange">表达难度</label><p>按词汇、句式和互动能力匹配真实水平。</p><span class="standard-tag">CEFR 国际能力框架</span></div><div class="range-zone" style="--progress:${(difficulty-1)/5*100}%"><header><strong data-level-label>${level.code} · ${level.label}</strong><span data-level-detail>${level.detail}</span></header><input id="difficultyRange" type="range" min="1" max="6" step="1" value="${difficulty}" data-setting="difficulty" aria-valuetext="CEFR ${level.code}，${level.label}"><div class="range-marks six" aria-hidden="true">${CEFR_LEVELS.map((item,index)=>`<i class="${index<difficulty?"passed":""} ${index===difficulty-1?"current":""}"></i>`).join("")}</div><div class="cefr-labels">${CEFR_LEVELS.map((item,index)=>`<span class="${index===difficulty-1?"active":""}">${item.code}</span>`).join("")}</div></div></section>
    <section class="settings-details"><div><div class="detail-title"><strong>反馈方式</strong><span>对话与训练</span></div><label class="toggle-line"><span>先听完表达，再给建议</span><button class="switch" type="button" data-action="toggle-setting" data-key="listenFirst" aria-pressed="${state.settings.listenFirst}"><i></i></button></label><label class="toggle-line"><span>停顿较久时主动延续话题</span><button class="switch" type="button" data-action="toggle-setting" data-key="proactive" aria-pressed="${state.settings.proactive}"><i></i></button></label></div><div><div class="detail-title"><strong>助手声音</strong><span>示范音频同步</span></div><div class="voice-box"><span>CL</span><p><strong>Clara</strong><small>温和清晰 · 美式英语</small></p><button type="button" data-action="play" data-id="clara" aria-label="试听 Clara">${icon("play")}</button></div></div></section>
    <section class="settings-details"><div><div class="detail-title"><strong>界面背景</strong><span>实时预览</span></div><div class="theme-list">${[["snow","雪白","#fbfaf6"],["polar","极地","#eef2f3"],["paper","暖纸","#f3ece1"],["sand","浅沙","#eee7da"]].map(([id,label,color])=>`<button class="${state.theme===id?"active":""}" type="button" data-action="theme" data-theme="${id}"><i style="--swatch:${color}"></i>${label}</button>`).join("")}</div></div><div><div class="detail-title"><strong>即时说明</strong><span>根据当前设置</span></div><div class="voice-box"><span>AI</span><p><strong data-setting-summary>${speed} WPM · CEFR ${level.code}</strong><small>先听完表达，再给出简短建议</small></p><button type="button" data-action="play" data-id="summary" aria-label="试听当前设置">${icon("play")}</button></div></div></section>
    </div><footer class="settings-foot"><span data-save-note>${state.saveStatus==="dirty"?"有未保存的修改":state.saveStatus==="saving"?"正在保存设置":state.saveStatus==="saved"?"设置已应用到全部练习":"修改任意设置后即可保存"}</span><button class="save-btn ${state.saveStatus==="dirty"?"ready":""} ${state.saveStatus==="saving"?"saving":""} ${state.saveStatus==="saved"?"saved":""}" type="button" data-action="save-settings" aria-disabled="${state.saveStatus!=="dirty"}">${state.saveStatus==="saved"?"已保存":state.saveStatus==="saving"?"保存中":"保存设置"}</button></footer></section>`);
}

export function renderProfile(section, state) {
  if (section === "assets") return assets();
  if (section === "scenes") return scenes();
  if (section === "settings") return settings(state);
  return overview(state);
}
