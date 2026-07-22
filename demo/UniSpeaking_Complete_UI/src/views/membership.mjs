import { pageHeading, icon } from "../components.mjs";

export function renderMembership(state) {
  const currentPlan = state.membership || "free";
  const isPremium = currentPlan === "premium" || currentPlan === "ielts";
  const isIelts = currentPlan === "ielts";

  const quotaUsed = state.quotaUsed || 45;
  const quotaTotal = currentPlan === "free" ? 60 : currentPlan === "premium" ? 300 : 600;
  const quotaPercent = Math.min(100, (quotaUsed / quotaTotal) * 100);

  const selectedPlanName = state.selectedPlan === "premium" ? "专业版 Premium" : "雅思特训版 IELTS Pro";
  const selectedPlanPrice = state.selectedPlan === "premium" ? "48" : "198";

  return `<section class="standard-page membership-page view-enter">
    ${pageHeading("Membership & Pricing / Subscription", "会员与订阅中心", "解锁更高强度的 AI 对话额度、深度语法纠正及雅思专属测评服务。")}

    <div class="membership-layout">
      <!-- Left side: Current status and usage -->
      <div class="membership-status panel">
        <div class="status-header">
          <p class="eyebrow">Current Plan</p>
          <div class="plan-badge-row">
            <span class="plan-badge ${currentPlan}">${currentPlan === "free" ? "免费版" : currentPlan === "premium" ? "专业版" : "雅思特训版"}</span>
            <h2>${currentPlan === "free" ? "探索期体验" : currentPlan === "premium" ? "专业智能陪练" : "雅思口语通关"}</h2>
          </div>
        </div>

        <div class="quota-card">
          <div class="quota-info">
            <span>AI 对话时长额度</span>
            <strong>${quotaUsed} <small>/ ${quotaTotal} 分钟</small></strong>
          </div>
          <div class="quota-bar"><i style="width: ${quotaPercent}%"></i></div>
          <p class="quota-note">每月1日重置额度。专业版及以上享更低延迟的回应体验。</p>
        </div>

        <div class="benefits-summary">
          <h3>您目前拥有的权益</h3>
          <ul>
            <li>${icon("check")} 每日 10 分钟 AI 自由对话</li>
            <li>${icon("check")} 基础场景练习（如咖啡店点单）</li>
            <li>${icon("check")} 基础口语发音流利度得分评估</li>
            <li class="${isPremium ? "active" : "locked"}">${isPremium ? icon("check") : "🔒"} 每日不限时 AI 对话与实时打断</li>
            <li class="${isPremium ? "active" : "locked"}">${isPremium ? icon("check") : "🔒"} 深度语法纠错与错题修改对比</li>
            <li class="${isIelts ? "active" : "locked"}">${isIelts ? icon("check") : "🔒"} 雅思口语真题模拟与官方标准打分报告</li>
          </ul>
        </div>
      </div>

      <!-- Right side: Subscription pricing cards -->
      <div class="membership-plans">
        <div class="plans-grid">
          <!-- Premium Plan Card -->
          <article class="pricing-card premium ${currentPlan === "premium" ? "active" : ""}">
            <div class="card-glow"></div>
            <div class="pricing-head">
              <span class="pop-tag">最受欢迎</span>
              <p class="eyebrow">Premium</p>
              <h2>专业版</h2>
              <div class="price">
                <span class="currency">¥</span>
                <span class="amount">48</span>
                <span class="period">/ 月</span>
              </div>
              <p class="desc">适合日常口语提升与流利沟通训练</p>
            </div>
            <div class="pricing-features">
              <ul>
                <li>${icon("check")} 每日不限时 AI 自由对话</li>
                <li>${icon("check")} 解锁全部 50+ 真实生活与工作场景</li>
                <li>${icon("check")} 深度智能语法纠正与跟读建议</li>
                <li>${icon("check")} 专属 Clara 等多种高保真伴侣音色</li>
              </ul>
            </div>
            <button class="primary-btn plan-btn" type="button" data-action="subscribe-plan" data-plan="premium">
              ${currentPlan === "premium" ? "当前订阅中" : "立即升级专业版"}
            </button>
          </article>

          <!-- IELTS Pro Plan Card -->
          <article class="pricing-card ielts ${currentPlan === "ielts" ? "active" : ""}">
            <div class="pricing-head">
              <p class="eyebrow">IELTS Pro</p>
              <h2>雅思特训版</h2>
              <div class="price">
                <span class="currency">¥</span>
                <span class="amount">198</span>
                <span class="period">/ 月</span>
              </div>
              <p class="desc">专为备考雅思、英文面试者设计</p>
            </div>
            <div class="pricing-features">
              <ul>
                <li>${icon("check")} 包含专业版 (Premium) 所有权益</li>
                <li>${icon("check")} 雅思口语 Part 1/2/3 模拟实战</li>
                <li>${icon("check")} 针对四项标准评分的官方维度报告</li>
                <li>${icon("check")} 真题库每周更新与错题针对性巩固</li>
              </ul>
            </div>
            <button class="outline-btn plan-btn" type="button" data-action="subscribe-plan" data-plan="ielts">
              ${currentPlan === "ielts" ? "当前订阅中" : "立即升级雅思版"}
            </button>
          </article>
        </div>
      </div>
    </div>

    <!-- Payment Checkout Modal -->
    ${state.paymentModalOpen ? `
      <div class="payment-modal-backdrop" id="payment-modal">
        <div class="payment-modal panel view-enter">
          <header class="modal-header">
            <h2>确认订单与支付</h2>
            <button class="close-btn" type="button" data-action="close-payment-modal">&times;</button>
          </header>
          
          <div class="order-details">
            <div class="order-item">
              <span>订购项目</span>
              <strong>${selectedPlanName}</strong>
            </div>
            <div class="order-item">
              <span>支付金额</span>
              <strong class="price-amount">¥ ${selectedPlanPrice}.00</strong>
            </div>
          </div>

          <div class="payment-method-selector">
            <button class="method-btn ${state.paymentMethod === "wechat" ? "active" : ""}" type="button" data-action="select-payment-method" data-method="wechat">微信支付</button>
            <button class="method-btn ${state.paymentMethod === "alipay" ? "active" : ""}" type="button" data-action="select-payment-method" data-method="alipay">支付宝</button>
          </div>

          <div class="qr-code-zone">
            <div class="qr-code-wrapper">
              <!-- Animated QR code simulation -->
              <div class="mock-qr-code">
                <div class="qr-scanner-line"></div>
                <div class="qr-corners"><i></i><i></i><i></i><i></i></div>
                <span class="qr-logo">${state.paymentMethod === "wechat" ? "WX" : "AL"}</span>
              </div>
            </div>
            <p>请使用手机 ${state.paymentMethod === "wechat" ? "微信" : "支付宝"} 扫码完成支付</p>
          </div>

          <footer class="modal-foot">
            <button class="outline-btn" type="button" data-action="close-payment-modal">取消</button>
            <button class="primary-btn" type="button" data-action="confirm-mock-payment">我已完成支付</button>
          </footer>
        </div>
      </div>
    ` : ""}
  </section>`;
}
