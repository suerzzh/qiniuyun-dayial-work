import React from "react";
import PageHeading from "../components/PageHeading";
import Icon from "../components/Icon";
import { mockSessions } from "../data";

export default function ReviewView({ state, updateState }) {
  const activeSessionId = state.activeSessionId || "cafe";
  const activeSession = mockSessions.find((s) => s.id === activeSessionId) || mockSessions[0];

  const filters = [
    ["all", "全部"],
    ["word", "单词"],
    ["phrase", "短语"],
    ["sentence", "句子"],
  ];

  const handleFilterClick = (filter) => {
    updateState({ reviewFilter: filter });
  };

  const handlePlayClick = (id, e) => {
    e.stopPropagation();
    const playId = `review-${id}`;
    updateState({ playingId: state.playingId === playId ? "" : playId });
  };

  const handleGoToDetail = (index) => {
    updateState({ activeAsset: index });
    window.location.hash = `#/review/${activeSession.id}`;
  };

  const filteredItems =
    state.reviewFilter === "all"
      ? activeSession.assets
      : activeSession.assets.filter((item) => item.kind === state.reviewFilter);

  return (
    <section className="standard-page review-page view-enter">
      <PageHeading
        eyebrow=""
        title="复习已经学过的表达"
        description="按单词、短语和句子分类，选择一个学习项重新试听与跟读。"
      />

      <div className="review-overview">
        {/* Left side: Scenes list */}
        <aside className="review-scenes panel">
          <div style={{ flex: 1, overflowY: "auto", marginTop: "12px" }}>
            {mockSessions.map((session) => {
              const isActive = session.id === activeSession.id;
              const totalCount = session.stats.word + session.stats.phrase + session.stats.sentence;
              return (
                <button
                  key={session.id}
                  className={`review-scene-card-btn ${isActive ? "active" : ""}`}
                  type="button"
                  onClick={() => updateState({ activeSessionId: session.id, reviewFilter: "all", activeAsset: 0 })}
                >
                  <span className="scene-meta">{session.meta.split(" · ")[1]}</span>
                  <strong>{session.title}</strong>
                  <div className="scene-stats-row">
                    <span>{totalCount} 个语言资产</span>
                    <span style={{ fontSize: "8px", opacity: 0.7 }}>已归档</span>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="policy-copy" style={{ marginTop: "12px", borderTop: "1px solid var(--line)", paddingTop: "12px" }}>
            <a 
              className="primary-btn full" 
              href={`#/review/${activeSession.id}`}
              onClick={() => updateState({ activeAsset: 0 })}
              style={{ width: "100%", justifyContent: "center", marginBottom: "12px" }}
            >
              打开当前学习资产 <Icon name="arrow" />
            </a>
            <p style={{ margin: 0, fontSize: "10px", color: "var(--quiet)", textAlign: "center" }}>
              训练流程已经结束；这里仅练习保存的语言内容。
            </p>
          </div>
        </aside>

        {/* Right side: Assets list */}
        <section className="review-library panel">
          <header>
            <div>
              <h2>学习资产 ({activeSession.title})</h2>
            </div>
            <div className="filter-tabs" role="group" aria-label="复习分类">
              {filters.map(([id, label]) => (
                <button
                  key={id}
                  className={state.reviewFilter === id ? "active" : ""}
                  type="button"
                  onClick={() => handleFilterClick(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </header>

          <div className="review-list">
            {filteredItems.map((item) => {
              const isPlaying = state.playingId === `review-${item.id}`;
              return (
                <article 
                  key={item.id} 
                  onClick={() => handlePlayClick(item.id)} 
                  style={{ display: "grid", gridTemplateColumns: "48px 1fr 40px", cursor: "pointer", transition: "background 0.2s" }}
                  className="review-item-row"
                  onMouseEnter={(e) => e.currentTarget.style.background = "var(--soft)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                >
                  <span className="asset-kind">{item.type}</span>
                  <div style={{ minWidth: 0 }}>
                    <h3 style={{ margin: "0 0 2px" }}>{item.text}</h3>
                    <p style={{ margin: "0 0 4px", color: "var(--muted)" }}>{item.translation}</p>
                    <span className="review-tag">{item.note}</span>
                  </div>
                  <button
                    className="icon-action"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlayClick(item.id);
                    }}
                    aria-label={`试听 ${item.text}`}
                  >
                    <Icon name={isPlaying ? "pause" : "volume"} />
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </section>
  );
}
