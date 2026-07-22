import { TRAINING_STEPS } from "./data.mjs";

const paths = {
  plus:'<path d="M12 5v14M5 12h14"/>',
  chat:'<path d="M5 18l-1 3 4-2h8a5 5 0 0 0 5-5V8a5 5 0 0 0-5-5H8a5 5 0 0 0-5 5v6a5 5 0 0 0 2 4z"/>',
  play:'<path d="m9 7 8 5-8 5z"/>', pause:'<path d="M9 7v10M15 7v10"/>',
  mic:'<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  help:'<path d="M8.8 9a3.2 3.2 0 1 1 5.2 2.5c-1.2.8-2 1.3-2 2.5M12 18h.01"/>',
  arrow:'<path d="M5 12h14M14 7l5 5-5 5"/>',
  book:'<path d="M4 5.5c3-1 5-.4 8 1.5v12c-3-1.9-5-2.5-8-1.5zM20 5.5c-3-1-5-.4-8 1.5v12c3-1.9 5-2.5 8-1.5z"/>',
  home:'<path d="M4 10.5 12 4l8 6.5V20H4zM9 20v-6h6v6"/>',
  bookmark:'<path d="M6 4h12v16l-6-4-6 4z"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a8 8 0 0 0-1.8-1L14.4 3h-4.8l-.4 3.1a8 8 0 0 0-1.8 1L5 6.1 3 9.5 5.1 11a7 7 0 0 0 0 2L3 14.5 5 18l2.4-1a8 8 0 0 0 1.8 1l.4 3h4.8l.4-3a8 8 0 0 0 1.8-1l2.4 1 2-3.5-2.1-1.5c.1-.3.1-.7.1-1z"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  volume:'<path d="M5 10v4h3l4 4V6L8 10zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
};

export const icon = (name, className = "") => `<svg class="icon ${className}" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.arrow}</svg>`;
export const escapeHTML = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" })[char]);

export function voiceOrb(state = "ready", label = "点击开始说话") {
  return `<button class="voice-orb is-${state}" type="button" data-action="voice-orb" aria-label="${label}">
    <span class="orb-core"></span><span class="orb-ring ring-a"></span><span class="orb-ring ring-b"></span>
    <span class="orb-bars" aria-hidden="true">${Array.from({length:7},()=>"<i></i>").join("")}</span>
  </button>`;
}

export function stageProgress(current) {
  const currentIndex = TRAINING_STEPS.findIndex((step) => step.id === current);
  return `<ol class="stage-progress" aria-label="训练进度">${TRAINING_STEPS.map((step,index)=>{
    const isDone = index < currentIndex;
    const isCurrent = index === currentIndex;
    const inner = `<span>${isDone ? icon("check") : index + 1}</span><b>${step.label}</b>`;
    return `<li class="${isDone ? "done" : isCurrent ? "current" : ""}">
      ${isDone ? `<a href="#/training/cafe/${step.id}" class="progress-step-link" title="返回${step.label}">${inner}</a>` : inner}
    </li>`;
  }).join("")}</ol>`;
}

export function profileSidebar(active) {
  const items = [
    ["overview","个人概览","home"],["assets","学习资产","book"],["scenes","常用场景","bookmark"],["settings","助手设置","gear"],
  ];
  return `<aside class="profile-side">
    <section class="account-card"><div class="account-line"><span class="profile-avatar">Y</span><div><h2>Yufan</h2><p>yufan@example.com</p></div></div><button class="outline-btn signout" type="button">退出登录</button></section>
    <p class="side-eyebrow">个人中心</p>
    <nav class="profile-nav" aria-label="个人中心导航">${items.map(([id,label,ico])=>`<a href="#/profile/${id}" class="${active===id?"active":""}" ${active===id?'aria-current="page"':""}>${icon(ico)}<span>${label}</span></a>`).join("")}</nav>
  </aside>`;
}

export function pageHeading(eyebrow, title, description, action = "") {
  return `<header class="page-heading"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p>${description}</p></div>${action}</header>`;
}
