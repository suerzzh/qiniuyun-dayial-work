import React from "react";
import Icon from "./Icon";

export default function ProfileSidebar({ active, user, onSignOut }) {
  const items = [
    ["overview", "个人概览", "home"],
    ["membership", "会员权益", "star"],
    ["settings", "助手设置", "gear"],
  ];

  return (
    <aside className="profile-side">
      <section className="account-card">
        <div className="account-line">
          <span className="profile-avatar">{user ? user.name[0] : "Y"}</span>
          <div>
            <h2>{user ? user.name : "Yufan"}</h2>
            <p>{user ? user.email : "yufan@example.com"}</p>
          </div>
        </div>
        <button className="outline-btn signout" type="button" onClick={onSignOut}>
          退出登录
        </button>
      </section>
      <p className="side-eyebrow">个人中心</p>
      <nav className="profile-nav" aria-label="个人中心导航">
        {items.map(([id, label, ico]) => (
          <a
            key={id}
            href={`#/profile/${id}`}
            className={active === id ? "active" : ""}
            aria-current={active === id ? "page" : undefined}
          >
            <Icon name={ico} />
            <span>{label}</span>
          </a>
        ))}
      </nav>
    </aside>
  );
}
