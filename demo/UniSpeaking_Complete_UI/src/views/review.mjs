import { learningAssets, pronunciationHistory } from "../data.mjs";
import { escapeHTML, icon, pageHeading, voiceOrb } from "../components.mjs";

export function renderReview(state) {
  const filters = [["all","全部"],["word","单词"],["phrase","短语"],["sentence","句子"]];
  const items = state.reviewFilter === "all" ? learningAssets : learningAssets.filter((item)=>item.kind===state.reviewFilter);
  return `<section class="standard-page review-page view-enter">${pageHeading("Review / Learning assets","复习已经学过的表达","按单词、短语和句子分类，选择一个学习项重新试听与跟读。",'<a class="outline-btn" href="#/review/cafe">查看发音历史</a>')}
    <div class="review-overview"><aside class="review-scenes panel"><div><p class="eyebrow">Saved session</p><h2>咖啡店点单</h2><p>4 个学习项 · 最近练习于今天</p></div><div class="session-summary"><span>单词<strong>1</strong></span><span>短语<strong>2</strong></span><span>句子<strong>1</strong></span></div><a class="primary-btn full" href="#/review/cafe">打开学习资产 ${icon("arrow")}</a><p class="policy-copy">训练流程已经结束；这里仅练习保存的语言内容。</p></aside>
      <section class="review-library panel"><header><div><p class="eyebrow">Words · phrases · sentences</p><h2>学习资产</h2></div><div class="filter-tabs" role="group" aria-label="复习分类">${filters.map(([id,label])=>`<button class="${state.reviewFilter===id?"active":""}" type="button" data-action="review-filter" data-filter="${id}">${label}</button>`).join("")}</div></header><div class="review-list">${items.map((item)=>`<article><span class="asset-kind">${item.type}</span><div><h3>${escapeHTML(item.text)}</h3><p>${item.translation}</p></div><button class="icon-action" type="button" data-action="play" data-id="review-${item.id}" aria-label="试听 ${escapeHTML(item.text)}">${icon(state.playingId===`review-${item.id}`?"pause":"volume")}</button><a class="text-action" href="#/review/cafe">复练</a></article>`).join("")}</div></section>
    </div></section>`;
}

export function renderReviewDetail(state) {
  const active = learningAssets[state.activeAsset] || learningAssets[0];
  const isMastered = state.masteryStatus?.[active.id] === "mastered";
  
  // Grammar correction data mapping
  const grammarCorrs = {
    recommend: {
      original: "Could you <del>recommend me</del> something less sweet?",
      corrected: "Could you <ins>recommend</ins> something less sweet?",
      note: "<strong>用法纠错</strong>：recommend 是及物动词，其后直接加推荐的物品即可。不加宾语代词。如果是针对人，用 recommend something to someone。"
    },
    different: {
      original: "I feel like <del>to try</del> something different today.",
      corrected: "I feel like <ins>trying</ins> something different today.",
      note: "<strong>搭配纠错</strong>：feel like 后面应该接动名词 (doing)，不接动词不定式 (to do)。"
    },
    order: {
      original: "Could you <del>recommend me</del> something less sweet?",
      corrected: "Could you <ins>recommend</ins> something less sweet?",
      note: "<strong>发音与连读提示</strong>：Could you 中的 d 与 y 可发生同化连读为 /kʊdʒu/，使发音更流畅。"
    },
    milk: {
      original: "latte <del>with the oat milk</del>",
      corrected: "latte <ins>with oat milk</ins>",
      note: "<strong>冠词纠错</strong>：表示“加燕麦奶”，一般不加定冠词 the，直接用 with oat milk 即可。"
    }
  };

  const corr = grammarCorrs[active.id] || null;
  const historyList = state.pronunciationHistory || pronunciationHistory;

  return `<section class="standard-page review-detail-page view-enter">
    ${pageHeading("Review / Cafe order", "咖啡店点单 · 学习资产", "训练已完成，您可以逐项试听、跟读并查看过去的发音检查。", '<a class="outline-btn" href="#/review">返回复习</a>')}
    
    <div class="review-detail-layout">
      <!-- Left side: context and grammar card -->
      <section class="context-panel panel">
        <div class="context-tabs">
          <button class="active" type="button">对话语境</button>
          <button type="button">表达解析</button>
        </div>
        
        <div class="context-turns">
          <article class="turn ai"><span>Barista</span><p>Would you like me to <mark>recommend</mark> something?</p></article>
          <article class="turn you"><span>You</span><p>I <mark>feel like trying something different</mark> today.</p></article>
          <article class="turn you"><span>You</span><p><mark>Could you recommend something less sweet?</mark></p></article>
        </div>

        ${corr ? `
          <div class="grammar-correction-card">
            <h3>📝 语法/用法纠错对比</h3>
            <div class="corr-comparison">
              <div class="corr-line original">
                <span>错误表达</span>
                <p>${corr.original}</p>
              </div>
              <div class="corr-line corrected">
                <span>正确推荐</span>
                <p>${corr.corrected}</p>
              </div>
            </div>
            <p class="corr-note">${corr.note}</p>
          </div>
        ` : ""}

        <div class="context-note">
          <strong>练习边界</strong>
          <p>每次只练当前语言内容，不会重新进入模拟流程或生成新的训练诊断。</p>
        </div>
      </section>

      <!-- Right side: active practice view -->
      <section class="repractice-panel panel">
        <header>
          <div>
            <p class="eyebrow">Selected item</p>
            <h2>${active.type}跟读与练习</h2>
          </div>
          <span>${state.activeAsset + 1} / ${learningAssets.length}</span>
        </header>

        <div class="asset-selector">
          ${learningAssets.map((item, index) => `
            <button class="${index === state.activeAsset ? "active" : ""}" type="button" data-action="select-asset" data-index="${index}">
              <span>${item.type}</span>
              <strong>${escapeHTML(item.text)}</strong>
            </button>
          `).join("")}
        </div>

        <div class="repractice-stage">
          <div class="mastery-row">
            <span>掌握状态：<strong class="${isMastered ? "mastered" : "learning"}">${isMastered ? "已掌握" : "学习中"}</strong></span>
            <button class="switch" type="button" data-action="toggle-mastery" data-id="${active.id}" aria-pressed="${isMastered}"><i></i></button>
          </div>

          <button class="audio-circle ${state.playingId === `detail-${active.id}` ? "active" : ""}" type="button" data-action="play" data-id="detail-${active.id}">
            ${icon(state.playingId === `detail-${active.id}` ? "pause" : "volume")}
          </button>
          
          <h2>${escapeHTML(active.text)}</h2>
          <p class="phonetic">${active.phonetic}</p>
          <p class="translation">${active.translation}</p>
          
          <div class="mini-record">
            ${voiceOrb(state.recording ? "listening" : state.voiceState === "evaluating" ? "listening" : "ready", state.recording ? "停止单项跟读" : "开始单项跟读")}
            <button class="primary-btn ${state.voiceState === "evaluating" ? "loading" : ""}" type="button" data-action="record" ${state.voiceState === "evaluating" ? "disabled" : ""}>
              ${icon("mic")} ${state.recording ? "完成跟读" : state.voiceState === "evaluating" ? "正在评估发音..." : "开始跟读"}
            </button>
          </div>
        </div>
      </section>
    </div>

    <!-- Pronunciation check history -->
    <section class="history-panel panel">
      <header>
        <div>
          <p class="eyebrow">Pronunciation history</p>
          <h2>历史发音检查回放</h2>
        </div>
        <p>比较每次节奏、重音和连读变化</p>
      </header>
      <div class="history-table">
        ${historyList.map((item) => `
          <article class="history-row-item">
            <button class="icon-action ${state.playingId === item.id ? "playing" : ""}" type="button" data-action="play" data-id="${item.id}" aria-label="播放 ${item.item}">
              ${icon(state.playingId === item.id ? "pause" : "play")}
            </button>
            <time>${item.date}</time>
            <strong>${item.item}</strong>
            <span>${item.duration}</span>
            <p>${item.result}</p>
          </article>
        `).join("")}
      </div>
    </section>
  </section>`;
}
