import React, { useState } from "react";
import PageHeading from "../components/PageHeading";

export default function AuthView({ state, updateState, showToast }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const activeTab = state.authTab || "code"; // "code" or "password"

  const handleTabSwitch = (tab) => {
    updateState({ authTab: tab });
  };

  const handleGetVerifyCode = () => {
    showToast("验证码已发送至您的手机/邮箱！");
  };

  const handleOAuthLogin = (providerName) => {
    const provider = providerName === "wechat" ? "微信" : "Apple ID";
    updateState({ user: { name: "Yufan", email: "yufan@example.com" } });
    showToast(`已使用 ${provider} 成功授权登录！`);
    window.location.hash = "#/conversation";
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!identifier.trim()) return;

    updateState({
      user: {
        name: identifier.split("@")[0] || "Yufan",
        email: identifier.trim()
      }
    });
    showToast("身份验证成功，欢迎使用 UniSpeaking！");
    window.location.hash = "#/conversation";
  };

  return (
    <section className="standard-page auth-page view-enter">
      <PageHeading
        eyebrow="Access UniSpeaking / Sign In"
        title="欢迎来到 UniSpeaking"
        description="请选择您的登录方式开始英语口语陪练体验。"
      />

      <div className="auth-container panel">
        <div className="auth-tabs">
          <button
            className={`auth-tab ${activeTab === "code" ? "active" : ""}`}
            type="button"
            onClick={() => handleTabSwitch("code")}
          >
            验证码登录
          </button>
          <button
            className={`auth-tab ${activeTab === "password" ? "active" : ""}`}
            type="button"
            onClick={() => handleTabSwitch("password")}
          >
            密码登录
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="auth-email">邮箱地址 / 手机号码</label>
            <div className="input-wrapper">
              <input
                type="text"
                id="auth-email"
                name="identifier"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="请输入您的邮箱或手机号"
              />
            </div>
          </div>

          {activeTab === "code" ? (
            <div className="form-group">
              <label htmlFor="auth-code">验证码</label>
              <div className="input-row">
                <div className="input-wrapper">
                  <input
                    type="text"
                    id="auth-code"
                    name="code"
                    required
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="输入6位验证码"
                  />
                </div>
                <button
                  className="outline-btn code-btn"
                  type="button"
                  onClick={handleGetVerifyCode}
                >
                  获取验证码
                </button>
              </div>
            </div>
          ) : (
            <div className="form-group">
              <label htmlFor="auth-password">登录密码</label>
              <div className="input-wrapper">
                <input
                  type="password"
                  id="auth-password"
                  name="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入登录密码"
                />
              </div>
            </div>
          )}

          <div className="form-agreement">
            <label className="checkbox-label">
              <input type="checkbox" defaultChecked required />
              <span>
                我已阅读并同意{" "}
                <a href="#/auth" className="quiet-link">
                  《用户使用协议》
                </a>{" "}
                与{" "}
                <a href="#/auth" className="quiet-link">
                  《隐私政策》
                </a>
              </span>
            </label>
          </div>

          <button className="primary-btn auth-submit-btn" type="submit">
            立即登录 / 注册
          </button>
        </form>

        <div className="auth-divider">
          <span>或使用第三方账号登录</span>
        </div>

        <div className="oauth-buttons">
          <button
            className="outline-btn oauth-btn"
            type="button"
            onClick={() => handleOAuthLogin("wechat")}
          >
            <i>WeChat</i> 微信登录
          </button>
          <button
            className="outline-btn oauth-btn"
            type="button"
            onClick={() => handleOAuthLogin("apple")}
          >
            <i>Apple</i> Apple 登录
          </button>
        </div>
      </div>
    </section>
  );
}
