import { pageHeading, icon } from "../components.mjs";
import { sceneCategories } from "../data.mjs";

export function renderScenes() {
  const allScenes = sceneCategories.flatMap((category) => 
    category.scenes.map((scene) => ({ ...scene, category: category.label }))
  );

  return `<section class="standard-page scene-page view-enter">
    ${pageHeading("","智能情景训练","AI 自由生成与常用高频情景实战")}
    
    <div class="scene-layout-unified">
      <!-- 1. Hero Section (Custom Generator & Pro Modules) -->
      <div class="scene-hero-row">
        <!-- Main: Custom Scene Generator (自定义场景) -->
        <section class="scene-builder panel premium">
          <div class="builder-header">
            <h2>AI 任意情景生成器</h2>
            <p class="desc">说清人物、地点和你想完成的任务，AI 会为你量身定制一套完整的词句跟读与正式模拟的实战路径。</p>
          </div>
          
          <div class="builder-body">
            <label for="scene-request">我想练习的场景：</label>
            <textarea id="scene-request" rows="3" placeholder="例如：下周要参加英文产品面试，希望练习介绍项目经历并回答追问。"></textarea>
            
            <div class="prompt-samples-row">
              <span>推荐灵感：</span>
              <div class="prompt-chips">
                <button type="button">酒店提前入住</button>
                <button type="button">向同事解释延期</button>
                <button type="button">第一次参加展会</button>
              </div>
            </div>
          </div>
          
          <button class="primary-btn generate-btn" type="button" data-action="generate-custom-scene">
            生成专属训练路径 ${icon("arrow")}
          </button>
        </section>

        <!-- Sidebar: Professional / Advanced Training Modules (专业训练) -->
        <section class="professional-card panel premium">
          <div class="pro-header">
            <h2>专业级口语特训</h2>
            <p class="desc">专门针对高频严肃场景设计的进阶提分通道，配有深度多维反馈标准。</p>
          </div>
          
          <div class="pro-body">
            <div class="pro-modules-list">
              <div class="pro-module-item">
                <div class="module-info">
                  <h3>IELTS 雅思口语特训</h3>
                  <p>还原真实考官追问，精准评估 CEFR 等级</p>
                </div>
                <button class="outline-btn" type="button">进入</button>
              </div>
              
              <div class="pro-module-item">
                <div class="module-info">
                  <h3>英文面试特训</h3>
                  <p>模拟外企/常青藤面试，强化经历陈述</p>
                </div>
                <button class="outline-btn" type="button">进入</button>
              </div>
            </div>
          </div>
        </section>
      </div>

      <!-- 2. Bottom Section: Daily Recommendation (每日推荐) -->
      <section class="scene-directory-compact">
        <div class="directory-header">
          <div class="title-left">
            <h2>每日推荐</h2>
            <p>为你精选的高频实用场景，每天一练</p>
          </div>
        </div>

        <div class="scene-grid-compact">
          ${(() => {
            const featuredScenes = allScenes.slice(0, 3);
            return featuredScenes.map((scene) => `
              <article class="scene-card-compact daily-featured">
                <div class="scene-art-mini art-${scene.art}" aria-hidden="true">
                  <i></i><i></i><i></i>
                </div>
                <div class="card-content">
                  <div class="card-info-main">
                    <div class="card-meta">
                      <small class="meta">${scene.meta}</small>
                    </div>
                    <h3>${scene.title}</h3>
                    <p class="desc">${scene.desc}</p>
                  </div>
                  <a class="action-link" href="#/training/cafe/words">进入场景 ${icon("arrow")}</a>
                </div>
              </article>
            `).join("");
          })()}
        </div>
      </section>
    </div>
  </section>`;
}
