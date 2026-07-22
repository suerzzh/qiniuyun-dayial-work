import React from "react";
import PageHeading from "../components/PageHeading";
import Icon from "../components/Icon";

export default function MembershipView({ state, updateState, showToast }) {
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
    <section className="standard-page membership-page view-enter">
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
                  <li><Icon name="check" /> 雅思口语 Part 1/2/3 模拟实战</li>
                  <li><Icon name="check" /> 针对四项标准评分的官方维度报告</li>
                  <li><Icon name="check" /> 真题库每周更新与错题针对性巩固</li>
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
}
