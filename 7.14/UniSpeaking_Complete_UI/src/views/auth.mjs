import { pageHeading, icon } from "../components.mjs";

export function renderAuth(state) {
  // Let's toggle between tab modes. In a mock UI, we can read from state if we want to store tab,
  // or just default to verification code login (sms/email code) which is very common.
  const activeTab = state.authTab || "code"; // "code" or "password"

  return `<section class="standard-page auth-page view-enter">
    ${pageHeading("Access UniSpeaking / Sign In", "欢迎来到 UniSpeaking", "请选择您的登录方式开始英语口语陪练体验。")}
    
    <div class="auth-container panel">
      <div class="auth-tabs">
        <button class="auth-tab ${activeTab === "code" ? "active" : ""}" type="button" data-action="auth-switch-tab" data-tab="code">验证码登录</button>
        <button class="auth-tab ${activeTab === "password" ? "active" : ""}" type="button" data-action="auth-switch-tab" data-tab="password">密码登录</button>
      </div>

      <form class="auth-form" data-action="submit-login">
        <div class="form-group">
          <label for="auth-email">邮箱地址 / 手机号码</label>
          <div class="input-wrapper">
            <input type="text" id="auth-email" name="identifier" required placeholder="请输入您的邮箱或手机号" value="${state.authEmail || ""}">
          </div>
        </div>

        ${activeTab === "code" ? `
          <div class="form-group">
            <label for="auth-code">验证码</label>
            <div class="input-row">
              <div class="input-wrapper">
                <input type="text" id="auth-code" name="code" required maxlength="6" placeholder="输入6位验证码">
              </div>
              <button class="outline-btn code-btn" type="button" data-action="get-verify-code">获取验证码</button>
            </div>
          </div>
        ` : `
          <div class="form-group">
            <label for="auth-password">登录密码</label>
            <div class="input-wrapper">
              <input type="password" id="auth-password" name="password" required placeholder="请输入登录密码">
            </div>
          </div>
        `}

        <div class="form-agreement">
          <label class="checkbox-label">
            <input type="checkbox" checked required>
            <span>我已阅读并同意 <a href="#/auth" class="quiet-link">《用户使用协议》</a> 与 <a href="#/auth" class="quiet-link">《隐私政策》</a></span>
          </label>
        </div>

        <button class="primary-btn auth-submit-btn" type="submit">立即登录 / 注册</button>
      </form>

      <div class="auth-divider">
        <span>或使用第三方账号登录</span>
      </div>

      <div class="oauth-buttons">
        <button class="outline-btn oauth-btn" type="button" data-action="oauth-login" data-provider="wechat">
          <i>WeChat</i> 微信登录
        </button>
        <button class="outline-btn oauth-btn" type="button" data-action="oauth-login" data-provider="apple">
          <i>Apple</i> Apple 登录
        </button>
      </div>
    </div>
  </section>`;
}
