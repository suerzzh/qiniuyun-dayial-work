import React, { useState } from "react";
import PageHeading from "../components/PageHeading";
import Icon from "../components/Icon";
import { sceneCategories } from "../data";

export default function ScenesView({ state, updateState, showToast }) {
  const [promptVal, setPromptVal] = useState("");

  const allScenes = sceneCategories.flatMap((category) =>
    category.scenes.map((scene) => ({ ...scene, category: category.label }))
  );

  const handleSampleClick = (text) => {
    setPromptVal(text);
  };

  const handleGenerate = () => {
    const trimmed = promptVal.trim();
    if (!trimmed) {
      showToast("请先在输入框描述你想练习的具体场景！");
      return;
    }
    updateState({
      customSceneConfig: {
        prompt: trimmed,
        difficulty: state.settings.difficulty,
        duration: 6,
        requirements: "要求词汇契合情境"
      }
    });
    window.location.hash = "#/custom-scene/generating";
  };

  return (
    <section className="standard-page scene-page view-enter">
      <PageHeading title="智能情景训练" description="AI 自由生成与常用高频情景实战" />

      <div className="scene-layout-unified">
        {/* 1. Hero Section */}
        <div className="scene-hero-row">
          {/* Custom Scene Generator */}
          <section className="scene-builder panel premium">
            <div className="builder-header">
              <h2>AI 任意情景生成器</h2>
              <p className="desc">
                说清人物、地点和你想完成的任务，AI 会为你量身定制一套完整的词句跟读与正式模拟的实战路径。
              </p>
            </div>

            <div className="builder-body">
              <label htmlFor="scene-request">我想练习的场景：</label>
              <textarea
                id="scene-request"
                rows="3"
                value={promptVal}
                onChange={(e) => setPromptVal(e.target.value)}
                placeholder="例如：下周要参加英文产品面试，希望练习介绍项目经历并回答追问。"
              ></textarea>

              <div className="prompt-samples-row">
                <span>推荐灵感：</span>
                <div className="prompt-chips">
                  <button type="button" onClick={() => handleSampleClick("酒店提前入住")}>
                    酒店提前入住
                  </button>
                  <button type="button" onClick={() => handleSampleClick("向同事解释延期")}>
                    向同事解释延期
                  </button>
                  <button type="button" onClick={() => handleSampleClick("第一次参加展会")}>
                    第一次参加展会
                  </button>
                </div>
              </div>
            </div>

            <button className="primary-btn generate-btn" type="button" onClick={handleGenerate}>
              生成专属训练路径 <Icon name="arrow" />
            </button>
          </section>

          {/* Professional Modules */}
          <section className="professional-card panel premium">
            <div className="pro-header">
              <h2>专业级口语特训</h2>
              <p className="desc">专门针对高频严肃场景设计的进阶提分通道，配有深度多维反馈标准。</p>
            </div>

            <div className="pro-body">
              <div className="pro-modules-list">
                <div className="pro-module-item">
                  <div className="module-info">
                    <h3>IELTS 雅思口语特训</h3>
                    <p>还原真实考官追问，精准评估 CEFR 等级</p>
                  </div>
                  <button className="outline-btn" type="button" onClick={() => window.location.hash = "#/ielts"}>
                    进入
                  </button>
                </div>

                <div className="pro-module-item">
                  <div className="module-info">
                    <h3>英文面试特训</h3>
                    <p>模拟外企/常青藤面试，强化经历陈述</p>
                  </div>
                  <button className="outline-btn" type="button" onClick={() => window.location.hash = "#/membership"}>
                    进入
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* 2. Bottom Section: Daily Recommendation */}
        <section className="scene-directory-compact">
          <div className="directory-header">
            <div className="title-left">
              <h2>每日推荐</h2>
              <p>为你精选的高频实用场景，每天一练</p>
            </div>
          </div>

          <div className="scene-grid-compact">
            {allScenes.slice(0, 3).map((scene) => (
              <article key={scene.id} className="scene-card-compact daily-featured">
                <div className={`scene-art-mini art-${scene.art}`} aria-hidden="true">
                  <i></i><i></i><i></i>
                </div>
                <div className="card-content">
                  <div className="card-info-main">
                    <div className="card-meta">
                      <small className="meta">{scene.meta}</small>
                    </div>
                    <h3>{scene.title}</h3>
                    <p className="desc">{scene.desc}</p>
                  </div>
                  <a
                    className="action-link"
                    href={scene.id === "restaurant"
                      ? "#/training/restaurant/simulation?direct=true"
                      : "#/training/cafe/words"}
                  >
                    进入场景 <Icon name="arrow" />
                  </a>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
