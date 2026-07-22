import React from "react";
import PageHeading from "../components/PageHeading";
import ProfileSidebar from "../components/ProfileSidebar";
import Icon from "../components/Icon";
import {
  CEFR_LEVELS,
  SPEED_META,
  WPM_VALUES,
  durationByDay,
  learningAssets,
  sceneCategories
} from "../data";

export default function ProfileView({ section, state, updateState, showToast }) {
  const totalDuration = durationByDay.reduce((sum, value) => sum + value, 0);
  const streak = state.hasCheckedIn ? 8 : 7;

  // Calendar render details
  const emptyCells = 2; // July 1 2026 is Wednesday
  const daysInJuly = 31;
  const todayDate = 13;

  const renderCalendar = () => {
    const cells = [];
    for (let i = 0; i < emptyCells; i++) {
      cells.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    }
    for (let day = 1; day <= daysInJuly; day++) {
      const isChecked = day < todayDate || (day === todayDate && state.hasCheckedIn);
      const isToday = day === todayDate;
      cells.push(
        <div
          key={`day-${day}`}
          className={`calendar-day ${isChecked ? "checked" : ""} ${isToday ? "today" : ""}`}
        >
          <span>{day}</span>
          {isChecked && <i></i>}
        </div>
      );
    }
    return cells;
  };

  const handleCheckIn = () => {
    updateState({ hasCheckedIn: true });
    showToast("每日打卡成功！已连续坚持 8 天。");
  };

  const handleSignOut = () => {
    updateState({ user: null });
    showToast("已安全退出登录");
    window.location.hash = "#/conversation";
  };

  // Sub-view: Overview Dashboard
  const renderOverview = () => {
    const capabilities = [
      { name: "发音清晰度 (Pronunciation)", value: 84, color: "#168f87" },
      { name: "流利度 (Fluency)", value: 78, color: "#e8462d" },
      { name: "词汇多样性 (Vocabulary)", value: 82, color: "#3d70e8" },
      { name: "语法正确度 (Grammar)", value: 75, color: "#e8a03d" },
      { name: "场景互动性 (Interaction)", value: 86, color: "#853de8" }
    ];

    const achievements = [
      { title: "开口先锋", desc: "完成首次自由对话", icon: "🎙️", unlocked: true },
      { title: "坚持不懈", desc: "连续坚持学习 7 天", icon: "🔥", unlocked: true },
      { title: "常用场景通关", desc: "通过咖啡店模拟训练", icon: "☕", unlocked: true },
      { title: "更上层楼", desc: "单项诊断达 90 分以上", icon: "🏆", unlocked: false }
    ];

    return (
      <section className="profile-dashboard panel">
        <header>
          <div>
            <p className="eyebrow">Personal overview</p>
            <h1>你的学习空间</h1>
            <p>记录您的发音细节、打卡天数 and 能力倾向成长曲线。</p>
          </div>
          <span className="local-badge">本地演示数据</span>
        </header>

        <div className="profile-stats">
          <article>
            <span><Icon name="clock" /></span>
            <p>本周学习时长</p>
            <strong>{totalDuration}<small>分钟</small></strong>
          </article>
          <article>
            <span><Icon name="book" /></span>
            <p>已保存学习资产</p>
            <strong>{learningAssets.length}<small>项</small></strong>
          </article>
          <article>
            <span><Icon name="bookmark" /></span>
            <p>连续学习天数</p>
            <strong>{streak}<small>天</small></strong>
          </article>
        </div>

        {/* Calendar Card */}
        <div className="calendar-card">
          <div className="calendar-info">
            <p className="eyebrow">Learning Calendar</p>
            <h2>7 月学习日历</h2>
            <div className="streak-box">
              <strong>{streak} <small>天</small></strong>
              <span>连续学习打卡</span>
            </div>
            <button
              className={`primary-btn checkin-btn ${state.hasCheckedIn ? "done" : ""}`}
              type="button"
              onClick={handleCheckIn}
              disabled={state.hasCheckedIn}
            >
              {state.hasCheckedIn ? (
                <>
                  <Icon name="check" /> 今日已打卡
                </>
              ) : (
                <>
                  <Icon name="plus" /> 立即打卡
                </>
              )}
            </button>
          </div>

          <div className="calendar-grid-wrapper">
            <div className="calendar-weekdays">
              <span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span>
            </div>
            <div className="calendar-days-grid">{renderCalendar()}</div>
          </div>
        </div>

        {/* Capability bars & charts */}
        <div className="duration-card">
          <div>
            <p className="eyebrow">Learning duration</p>
            <h2>最近 7 天时长</h2>
            <p>观察练习节奏，不设置过多压力指标。</p>
          </div>
          <div className="duration-chart" aria-label="最近七天学习时长">
            {durationByDay.map((value, index) => (
              <div key={index}>
                <i style={{ "--height": `${(value / 40) * 100}%` }}></i>
                <span>{["四", "五", "六", "日", "一", "二", "三"][index]}</span>
                <b>{value}m</b>
              </div>
            ))}
          </div>
        </div>

        {/* Achievements Wall */}
        <div className="achievements-section">
          <p className="eyebrow">Milestones</p>
          <h2>成就徽章墙</h2>
          <div className="achievements-grid">
            {achievements.map((ach) => (
              <div
                key={ach.title}
                className={`achievement-medal ${ach.unlocked ? "unlocked" : "locked"}`}
              >
                <span className="medal-icon">{ach.icon}</span>
                <div className="medal-copy">
                  <strong>{ach.title}</strong>
                  <small>{ach.desc}</small>
                </div>
                {ach.unlocked ? (
                  <span className="unlocked-badge">已解锁</span>
                ) : (
                  <span className="locked-badge">未解锁</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="profile-shortcuts" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <a href="#/profile/membership">
            <span><Icon name="star" /></span>
            <p><strong>会员权益</strong><small>查看会员与订阅中心</small></p>
            <Icon name="arrow" />
          </a>
          <a href="#/profile/settings">
            <span><Icon name="gear" /></span>
            <p><strong>助手设置</strong><small>调整语速与表达难度</small></p>
            <Icon name="arrow" />
          </a>
        </div>
      </section>
    );
  };

  // Sub-view: Learning Assets Index
  // Sub-view: Membership/Benefits Sub-tab
  const renderMembership = () => {
    const currentPlan = state.membership || "free";
    const isPremium = currentPlan === "premium" || currentPlan === "ielts";
    const isIelts = currentPlan === "ielts";

    const quotaUsed = state.quotaUsed || 45;
    const quotaTotal = currentPlan === "free" ? 60 : currentPlan === "premium" ? 300 : 600;
    const quotaPercent = Math.min(100, (quotaUsed / quotaTotal) * 100);

    const selectedPlanName = state.selectedPlan === "premium" ? "专业版 Premium" : "雅思特训版 IELTS Pro";
    const selectedPlanPrice = state.selectedPlan === "premium" ? "48" : "198";

    const handleSubscribeClick = (plan) => {
      if (currentPlan === plan) {
        showToast("您已是该级别会员，无需重复购买");
        return;
      }
      updateState({ paymentModalOpen: true, selectedPlan: plan, paymentMethod: "wechat" });
    };

    const handleConfirmMockPayment = () => {
      const plan = state.selectedPlan;
      updateState({ membership: plan, paymentModalOpen: false });
      showToast(`支付成功！已为您成功开通 ${plan === "premium" ? "专业版" : "雅思特训版"} 尊贵权益`);
    };

    return (
      <section className="profile-list-page panel">
        <PageHeading
          eyebrow="Membership & Pricing / Subscription"
          title="会员与订阅中心"
          description="解锁更高强度的 AI 对话额度、深度语法纠正及雅思专属测评服务。"
        />

        <div className="membership-layout">
          {/* Left side: Current status and usage */}
          <div className="membership-status panel">
            <div className="status-header">
              <p className="eyebrow">Current Plan</p>
              <div className="plan-badge-row">
                <span className={`plan-badge ${currentPlan}`}>
                  {currentPlan === "free" ? "免费版" : currentPlan === "premium" ? "专业版" : "雅思特训版"}
                </span>
                <h2>
                  {currentPlan === "free"
                    ? "探索期体验"
                    : currentPlan === "premium"
                    ? "专业智能陪练"
                    : "雅思口语通关"}
                </h2>
              </div>
            </div>

            <div className="quota-card">
              <div className="quota-info">
                <span>AI 对话时长额度</span>
                <strong>{quotaUsed} <small>/ {quotaTotal} 分钟</small></strong>
              </div>
              <div className="quota-bar">
                <i style={{ width: `${quotaPercent}%` }}></i>
              </div>
              <p className="quota-note">每月1日重置额度。专业版及以上享更低延迟的回应体验。</p>
            </div>

            <div className="benefits-summary">
              <h3>您目前拥有的权益</h3>
              <ul>
                <li><Icon name="check" /> 每日 10 分钟 AI 自由对话</li>
                <li><Icon name="check" /> 基础场景练习（如咖啡店点单）</li>
                <li><Icon name="check" /> 基础口语发音流利度得分评估</li>
                <li className={isPremium ? "active" : "locked"}>
                  {isPremium ? <Icon name="check" /> : "🔒"} 每日不限时 AI 对话与实时打断
                </li>
                <li className={isPremium ? "active" : "locked"}>
                  {isPremium ? <Icon name="check" /> : "🔒"} 深度语法纠错与错题修改对比
                </li>
                <li className={isIelts ? "active" : "locked"}>
                  {isIelts ? <Icon name="check" /> : "🔒"} 雅思口语真题模拟与官方标准打分报告
                </li>
              </ul>
            </div>
          </div>

          {/* Right side: Subscription pricing cards */}
          <div className="membership-plans">
            <div className="plans-grid">
              {/* Premium Plan Card */}
              <article className={`pricing-card premium ${currentPlan === "premium" ? "active" : ""}`}>
                <div className="card-glow"></div>
                <div className="pricing-head">
                  <span className="pop-tag">最受欢迎</span>
                  <p className="eyebrow">Premium</p>
                  <h2>专业版</h2>
                  <div className="price">
                    <span className="currency">¥</span>
                    <span className="amount">48</span>
                    <span className="period">/ 月</span>
                  </div>
                  <p className="desc">适合日常口语提升与流利沟通训练</p>
                </div>
                <div className="pricing-features">
                  <ul>
                    <li><Icon name="check" /> 每日不限时 AI 自由对话</li>
                    <li><Icon name="check" /> 解锁全部 50+ 真实生活与工作场景</li>
                    <li><Icon name="check" /> 深度智能语法纠正与跟读建议</li>
                    <li><Icon name="check" /> 专属 Clara 等多种高保真伴侣音色</li>
                  </ul>
                </div>
                <button
                  className="primary-btn plan-btn"
                  type="button"
                  onClick={() => handleSubscribeClick("premium")}
                >
                  {currentPlan === "premium" ? "当前订阅中" : "立即升级专业版"}
                </button>
              </article>

              {/* IELTS Pro Plan Card */}
              <article className={`pricing-card ielts ${currentPlan === "ielts" ? "active" : ""}`}>
                <div className="pricing-head">
                  <p className="eyebrow">IELTS Pro</p>
                  <h2>雅思特训版</h2>
                  <div className="price">
                    <span className="currency">¥</span>
                    <span className="amount">198</span>
                    <span className="period">/ 月</span>
                  </div>
                  <p className="desc">专为备考雅思、英文面试者设计</p>
                </div>
                <div className="pricing-features">
                  <ul>
                    <li><Icon name="check" /> 包含专业版 (Premium) 所有权益</li>
                    <li><Icon name="check" /> 针对四项标准评分的官方维度报告</li>
                  </ul>
                </div>
                <button
                  className="outline-btn plan-btn"
                  type="button"
                  onClick={() => handleSubscribeClick("ielts")}
                >
                  {currentPlan === "ielts" ? "当前订阅中" : "立即升级雅思版"}
                </button>
              </article>
            </div>
          </div>
        </div>

        {/* Payment Checkout Modal */}
        {state.paymentModalOpen && (
          <div className="payment-modal-backdrop" id="payment-modal">
            <div className="payment-modal panel view-enter">
              <header className="modal-header">
                <h2>确认订单与支付</h2>
                <button
                  className="close-btn"
                  type="button"
                  onClick={() => updateState({ paymentModalOpen: false })}
                >
                  &times;
                </button>
              </header>
              
              <div className="order-details">
                <div className="order-item">
                  <span>订购项目</span>
                  <strong>{selectedPlanName}</strong>
                </div>
                <div className="order-item">
                  <span>支付金额</span>
                  <strong className="price-amount">¥ {selectedPlanPrice}.00</strong>
                </div>
              </div>

              <div className="payment-method-selector">
                <button
                  className={`method-btn ${state.paymentMethod === "wechat" ? "active" : ""}`}
                  type="button"
                  onClick={() => updateState({ paymentMethod: "wechat" })}
                >
                  微信支付
                </button>
                <button
                  className={`method-btn ${state.paymentMethod === "alipay" ? "active" : ""}`}
                  type="button"
                  onClick={() => updateState({ paymentMethod: "alipay" })}
                >
                  支付宝
                </button>
              </div>

              <div className="qr-code-zone">
                <div className="qr-code-wrapper">
                  <div className="mock-qr-code">
                    <div className="qr-scanner-line"></div>
                    <div className="qr-corners"><i></i><i></i><i></i><i></i></div>
                    <span className="qr-logo">{state.paymentMethod === "wechat" ? "WX" : "AL"}</span>
                  </div>
                </div>
                <p>请使用手机 {state.paymentMethod === "wechat" ? "微信" : "支付宝"} 扫码完成支付</p>
              </div>

              <footer className="modal-foot">
                <button
                  className="outline-btn"
                  type="button"
                  onClick={() => updateState({ paymentModalOpen: false })}
                >
                  取消
                </button>
                <button className="primary-btn" type="button" onClick={handleConfirmMockPayment}>
                  我已完成支付
                </button>
              </footer>
            </div>
          </div>
        )}
      </section>
    );
  };

  // Sub-view: Settings
  const renderSettings = () => {
    const speed = state.settings.speed;
    const difficulty = state.settings.difficulty;
    const speedProgress = ((speed - 80) / 120) * 100;
    const roundedDifficulty = Math.round(difficulty);
    const level = CEFR_LEVELS[roundedDifficulty - 1] || CEFR_LEVELS[2];
    const roundedSpeed = Math.round(speed / 10) * 10;
    const speedMeta = SPEED_META[roundedSpeed] || SPEED_META[140];

    const handleSpeedChange = (e) => {
      const val = parseInt(e.target.value);
      updateState({
        settings: { ...state.settings, speed: val },
        saveStatus: "dirty"
      });
    };

    const handleSpeedSnap = (e) => {
      const val = parseInt(e.target.value);
      const snapped = Math.round(val / 10) * 10;
      updateState({
        settings: { ...state.settings, speed: snapped },
        saveStatus: "dirty"
      });
    };

    const handleDifficultyChange = (e) => {
      const val = parseFloat(e.target.value);
      updateState({
        settings: { ...state.settings, difficulty: val },
        saveStatus: "dirty"
      });
    };

    const handleDifficultySnap = (e) => {
      const val = parseFloat(e.target.value);
      const snapped = Math.round(val);
      updateState({
        settings: { ...state.settings, difficulty: snapped },
        saveStatus: "dirty"
      });
    };

    const handleToggleSetting = (key) => {
      updateState({
        settings: { ...state.settings, [key]: !state.settings[key] },
        saveStatus: "dirty"
      });
    };

    const handleThemeChange = (themeName) => {
      document.body.dataset.theme = themeName;
      updateState({ theme: themeName, saveStatus: "dirty" });
    };

    const handleSaveSettings = () => {
      if (state.saveStatus !== "dirty") {
        showToast("当前设置没有变化");
        return;
      }
      updateState({ saveStatus: "saving" });
      setTimeout(() => {
        updateState({ saveStatus: "saved" });
        setTimeout(() => {
          updateState({ saveStatus: "clean" });
        }, 1200);
      }, 520);
    };

    return (
      <section className="settings-shell panel">
        <header className="settings-head">
          <div>
            <p className="eyebrow">AI assistant</p>
            <h1>AI 助手设置</h1>
            <p>微调陪练节奏，让每一次开口更接近你的真实使用习惯。</p>
          </div>
          <div className={`sync-state is-${state.saveStatus}`}>
            <i></i>
            <span>
              {state.saveStatus === "dirty"
                ? "等待保存"
                : state.saveStatus === "saving"
                ? "正在保存"
                : state.saveStatus === "saved"
                ? "刚刚已同步"
                : "设置已同步"}
            </span>
          </div>
        </header>

        <div className="settings-body">
          {/*对话语速*/}
          <section className="setting-row">
            <div>
              <label htmlFor="speedRange">对话语速</label>
              <p>以每分钟词数精确控制回复与示范节奏。</p>
              <span className="standard-tag">WPM 量化速度</span>
            </div>
            <div className="range-zone" style={{ "--progress": `${speedProgress}%` }}>
              <header>
                <strong data-speed-label>{speedMeta[0]} · {speed} WPM</strong>
                <span data-speed-detail>{speedMeta[1]}</span>
              </header>
              <input
                id="speedRange"
                type="range"
                min="80"
                max="200"
                step="1"
                value={speed}
                onChange={handleSpeedChange}
                onMouseUp={handleSpeedSnap}
                onTouchEnd={handleSpeedSnap}
                aria-valuetext={`${speedMeta[0]}，${speed} WPM`}
              />
              <div className="range-marks" aria-hidden="true">
                {WPM_VALUES.map((value) => (
                  <i key={value} className={`${value <= speed ? "passed" : ""} ${Math.abs(value - speed) < 5 ? "current" : ""}`}></i>
                ))}
              </div>
              <div className="range-edge">
                <span>80 · 入门</span>
                <b>{speed} · {speedMeta[0]}</b>
                <span>200 · 挑战</span>
              </div>
            </div>
          </section>

          {/*表达难度*/}
          <section className="setting-row">
            <div>
              <label htmlFor="difficultyRange">表达难度</label>
              <p>按词汇、句式和互动能力匹配真实水平。</p>
              <span className="standard-tag">CEFR 国际能力框架</span>
            </div>
            <div
              className="range-zone"
              style={{ "--progress": `${((difficulty - 1) / 5) * 100}%` }}
            >
              <header>
                <strong data-level-label>{level.code} · {level.label}</strong>
                <span data-level-detail>{level.detail}</span>
              </header>
              <input
                id="difficultyRange"
                type="range"
                min="1"
                max="6"
                step="0.01"
                value={difficulty}
                onChange={handleDifficultyChange}
                onMouseUp={handleDifficultySnap}
                onTouchEnd={handleDifficultySnap}
                aria-valuetext={`CEFR ${level.code}，${level.label}`}
              />
              <div className="range-marks six" aria-hidden="true">
                {CEFR_LEVELS.map((item, index) => (
                  <i key={item.code} className={`${index < roundedDifficulty ? "passed" : ""} ${index === roundedDifficulty - 1 ? "current" : ""}`}></i>
                ))}
              </div>
              <div className="cefr-labels">
                {CEFR_LEVELS.map((item, index) => (
                  <span key={item.code} className={index === roundedDifficulty - 1 ? "active" : ""}>
                    {item.code}
                  </span>
                ))}
              </div>
            </div>
          </section>

          {/*助手声音*/}
          <section className="setting-row" style={{ display: "block", minHeight: "auto", padding: "20px 0" }}>
            <div style={{ marginBottom: "15px" }}>
              <label>助手声音</label>
              <p>选择不同人设与口音的 AI 陪练，微调训练语境。</p>
              <span className="standard-tag">6 种个性化音色</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
              {[
                { id: "clara", code: "CL", name: "Clara", accent: "美式随和", tag: "温柔耐心的私人电台主播，发音标准柔美，适合日常探索与纠错。" },
                { id: "james", code: "JA", name: "James", accent: "英式专业", tag: "资深牛津口语导师，发音优雅绅士，逻辑严密，适合学术与面试。" },
                { id: "leo", code: "LE", name: "Leo", accent: "美式活力", tag: "热心开朗的加州滑板教练，发音地道随性，喜欢用潮流词汇。" },
                { id: "emily", code: "EM", name: "Emily", accent: "澳式知性", tag: "热爱旅行的墨尔本摄影师，发音自然轻松，擅长分享多元文化。" },
                { id: "zara", code: "ZA", name: "Zara", accent: "英式干练", tag: "前沿科技公司产品总监，发音干练流利，用词精准，适合商务交流。" },
                { id: "david", code: "DA", name: "David", accent: "美式幽默", tag: "爱讲脱口秀的纽约咖啡师，发音活泼幽默，喜欢轻松引导开口。" }
              ].map((v) => {
                const isActive = (state.settings.voice || "clara") === v.id;
                const isPlaying = state.playingId === v.id;
                return (
                  <div
                    key={v.id}
                    onClick={() => {
                      updateState({
                        settings: { ...state.settings, voice: v.id },
                        saveStatus: "dirty"
                      });
                    }}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "34px 1fr auto",
                      alignItems: "center",
                      gap: "10px",
                      padding: "12px",
                      border: "1px solid",
                      borderColor: isActive ? "var(--ink)" : "var(--line)",
                      borderRadius: "12px",
                      background: isActive ? "#fafaf7" : "#fff",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      boxShadow: isActive ? "0 4px 12px rgba(0,0,0,0.04)" : "none"
                    }}
                    className="voice-card-select"
                  >
                    <span style={{
                      display: "grid",
                      width: "34px",
                      height: "34px",
                      placeItems: "center",
                      borderRadius: "50%",
                      background: isActive ? "#e6ffed" : "#f1f2ee",
                      color: isActive ? "#22863a" : "var(--ink)",
                      fontSize: "10px",
                      fontWeight: "bold"
                    }}>{v.code}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                        <strong style={{ fontSize: "11px" }}>{v.name}</strong>
                        <small style={{ color: "var(--muted)", fontSize: "8px" }}>{v.accent}</small>
                      </div>
                      <p style={{ margin: "2px 0 0", color: "var(--muted)", fontSize: "8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={v.tag}>
                        {v.tag}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlayClick(v.id);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "28px",
                        height: "28px",
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        color: isPlaying ? "var(--accent, #2b6cb0)" : "var(--muted)",
                        transition: "color 0.2s"
                      }}
                      aria-label={`试听 ${v.name}`}
                    >
                      <Icon name={isPlaying ? "pause" : "volume"} />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          {/*界面背景*/}
          <section className="setting-row" style={{ display: "block", minHeight: "auto", padding: "20px 0", borderBottom: "none" }}>
            <div style={{ marginBottom: "15px" }}>
              <label>界面背景</label>
              <p>自定义您的学习界面风格，实时响应切换。</p>
              <span className="standard-tag">实时预览</span>
            </div>
            <div className="theme-list" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
              {[
                ["snow", "雪白", "#fbfaf6"],
                ["polar", "极地", "#eef2f3"],
                ["paper", "暖纸", "#f3ece1"],
                ["sand", "浅沙", "#eee7da"]
              ].map(([id, label, color]) => (
                <button
                  key={id}
                  className={state.theme === id ? "active" : ""}
                  type="button"
                  onClick={() => handleThemeChange(id)}
                  style={{ width: "100%" }}
                >
                  <i style={{ "--swatch": color }}></i>
                  {label}
                </button>
              ))}
            </div>
          </section>
        </div>

        <footer className="settings-foot">
          <span>
            {state.saveStatus === "dirty"
              ? "有未保存的修改"
              : state.saveStatus === "saving"
              ? "正在保存设置"
              : state.saveStatus === "saved"
              ? "设置已应用到全部练习"
              : "修改任意设置后即可保存"}
          </span>
          <button
            className={`save-btn ${state.saveStatus === "dirty" ? "ready" : ""} ${state.saveStatus === "saving" ? "saving" : ""} ${state.saveStatus === "saved" ? "saved" : ""}`}
            type="button"
            onClick={handleSaveSettings}
            disabled={state.saveStatus !== "dirty"}
          >
            {state.saveStatus === "saved"
              ? "已保存"
              : state.saveStatus === "saving"
              ? "保存中"
              : "保存设置"}
          </button>
        </footer>
      </section>
    );
  };

  const handlePlayClick = (id) => {
    updateState({ playingId: state.playingId === id ? "" : id });
  };

  const content =
    section === "membership"
      ? renderMembership()
      : section === "settings"
      ? renderSettings()
      : renderOverview();

  return (
    <section className="profile-page view-enter">
      <ProfileSidebar active={section} user={state.user} onSignOut={handleSignOut} />
      <div className="profile-content">
        <p className="content-label">
          {section === "overview"
            ? "个人概览"
            : section === "membership"
            ? "会员权益"
            : "助手设置"}
        </p>
        {content}
      </div>
    </section>
  );
}
