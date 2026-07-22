import React, { useState, useEffect } from "react";
import ConversationView from "./views/ConversationView";
import ScenesView from "./views/ScenesView";
import TrainingView from "./views/TrainingView";
import ReviewView from "./views/ReviewView";
import ReviewDetailView from "./views/ReviewDetailView";
import ProfileView from "./views/ProfileView";
import AuthView from "./views/AuthView";
import MembershipView from "./views/MembershipView";
import CustomSceneView from "./views/CustomSceneView";
import IeltsView from "./views/IeltsView";
import { globalSection, parseRoute } from "./router.mjs";

const defaultState = {
  conversations: [
    {
      id: "lunch",
      title: "午餐与同学",
      time: "今天 12:40",
      turns: [
        ["AI", "How was lunch with your classmates today?"],
        [
          "You",
          "It was relaxing. We talked about our group project and the food near campus."
        ],
        ["AI", "That sounds nice. Which part of the project are you taking care of?"]
      ]
    },
    {
      id: "movie",
      title: "最近看的电影",
      time: "昨天",
      turns: [
        ["You", "I watched a documentary about ocean exploration."],
        ["AI", "What surprised you most about it?"]
      ]
    },
    {
      id: "weekend",
      title: "周末计划",
      time: "周一",
      turns: [
        ["AI", "Do you have anything planned for this weekend?"],
        ["You", "I might visit a small exhibition downtown."]
      ]
    }
  ],
  activeConversation: "lunch",
  voiceState: "ready",
  transcriptDraft: "",
  textOpen: false,
  muted: false,
  activeAsset: 0,
  reviewFilter: "all",
  playingId: "",
  recording: false,
  settings: { speed: 140, difficulty: 3, listenFirst: true, proactive: true, voice: "clara" },
  theme: "polar",
  saveStatus: "clean",
  mobileNavOpen: false,
  user: { name: "Yufan", email: "yufan@example.com" },
  membership: "free",
  hasCheckedIn: false,
  masteryStatus: {},
  customSceneConfig: { prompt: "", difficulty: 3, duration: 5, requirements: "" },
  paymentModalOpen: false,
  scoreModalOpen: false,
  attempts: {},
  activeEval: null,
  sentenceScores: {},
  showSimulationTips: false,
  translatedTurns: {},
  pronunciationHistory: [
    {
      id: "h1",
      date: "7 月 10 日 · 14:32",
      item: "Could you recommend…",
      duration: "00:08",
      result: "重音准确，尾音可更轻"
    },
    {
      id: "h2",
      date: "7 月 9 日 · 20:16",
      item: "feel like trying…",
      duration: "00:06",
      result: "节奏稳定，trying 连读更自然"
    },
    {
      id: "h3",
      date: "7 月 8 日 · 11:05",
      item: "recommend",
      duration: "00:04",
      result: "末音节重音已改善"
    }
  ],
  authTab: "code",
  activeSessionId: "cafe",
  isDirectSimulation: false
};

const getInitialState = () => {
  try {
    const saved = localStorage.getItem("unispeaking-ui");
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...defaultState, ...parsed };
    }
  } catch (e) {
    // Ignore localstorage reading issues
  }
  return defaultState;
};

export default function App() {
  const [state, setState] = useState(getInitialState);
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  
  // Toast notifications state
  const [toastMsg, setToastMsg] = useState("");
  const [toastShow, setToastShow] = useState(false);
  const [toastTimer, setToastTimer] = useState(null);

  // Sync state changes with localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        "unispeaking-ui",
        JSON.stringify({
          settings: state.settings,
          theme: state.theme,
          activeConversation: state.activeConversation,
          user: state.user,
          membership: state.membership,
          hasCheckedIn: state.hasCheckedIn,
          masteryStatus: state.masteryStatus,
          customSceneConfig: state.customSceneConfig,
          pronunciationHistory: state.pronunciationHistory,
          conversations: state.conversations
        })
      );
    } catch (e) {
      // Ignore localstorage issues
    }
  }, [state]);

  // Sync body theme dataset attribute
  useEffect(() => {
    document.body.dataset.theme = state.theme;
  }, [state.theme]);

  // Listen to hash change routing events
  useEffect(() => {
    const handleHashChange = () => {
      const parsed = parseRoute(window.location.hash);
      if (parsed.invalid) {
        window.history.replaceState(null, "", "#/conversation");
        showToast("页面不存在，已返回自由对话");
      }
      
      // Reset specific training options on page leave/enter
      if (parsed.name === "training") {
        const subStage = parsed.params.stage || "words";
        setState((prev) => {
          const stages = ["words", "sentences", "simulation"];
          const currentIdx = stages.indexOf(subStage);
          const maxIdx = stages.indexOf(prev.maxStage || "words");
          const nextMaxStage = currentIdx > maxIdx ? subStage : (prev.maxStage || "words");
          return {
            ...prev,
            activeAsset: 0,
            recording: false,
            playingId: "",
            scoreModalOpen: false,
            mobileNavOpen: false,
            maxStage: nextMaxStage
          };
        });
      } else {
        setState((prev) => ({
          ...prev,
          recording: false,
          playingId: "",
          scoreModalOpen: false,
          mobileNavOpen: false
        }));
      }
      setRoute(parsed);
    };

    window.addEventListener("hashchange", handleHashChange);
    
    // Redirect if no initial hash
    if (!window.location.hash) {
      window.location.hash = "#/conversation";
    }

    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const updateState = (patch) => {
    setState((prev) => ({
      ...prev,
      ...(typeof patch === "function" ? patch(prev) : patch)
    }));
  };

  const showToast = (message) => {
    if (toastTimer) clearTimeout(toastTimer);
    setToastMsg(message);
    setToastShow(true);
    const timer = setTimeout(() => {
      setToastShow(false);
    }, 2200);
    setToastTimer(timer);
  };

  const toggleMobileNav = () => {
    updateState({ mobileNavOpen: !state.mobileNavOpen });
  };

  const activeSection = globalSection(route.name);

  // Render current view
  const renderView = () => {
    switch (route.name) {
      case "scenes":
        return <ScenesView state={state} updateState={updateState} showToast={showToast} />;
      case "ielts":
        return <div className="ielts-page"><IeltsView /></div>;
      case "training":
        return <TrainingView stage={route.params.stage} scene={route.params.scene} state={state} updateState={updateState} showToast={showToast} />;
      case "review":
        return <ReviewView state={state} updateState={updateState} />;
      case "review-detail":
        return <ReviewDetailView state={state} updateState={updateState} showToast={showToast} />;
      case "profile":
        return <ProfileView section={route.params.section} state={state} updateState={updateState} showToast={showToast} />;
      case "auth":
        return <AuthView state={state} updateState={updateState} showToast={showToast} />;
      case "membership":
        setTimeout(() => { window.location.hash = "#/profile/membership"; }, 0);
        return null;
      case "custom-scene-generating":
        return <CustomSceneView mode="generating" state={state} updateState={updateState} />;
      case "custom-scene-preview":
        return <CustomSceneView mode="preview" state={state} updateState={updateState} />;
      case "conversation":
      default:
        return <ConversationView state={state} updateState={updateState} />;
    }
  };

  return (
    <div className={`app-shell ${state.mobileNavOpen ? "mobile-nav-open" : ""}`} id="app-shell">
      <header className="topbar">
        <a className="brand" href="#/conversation" aria-label="UniSpeaking 自由对话">
          <span className="brand-mark" aria-hidden="true">
            <i></i><i></i><i></i>
          </span>
          <span>UniSpeaking</span>
        </a>
        
        <button
          className="mobile-nav-toggle"
          type="button"
          onClick={toggleMobileNav}
          aria-label="展开导航"
          aria-expanded={state.mobileNavOpen}
        >
          <span></span><span></span>
        </button>
        
        <nav className="global-nav" aria-label="全局导航">
          <a
            href="#/conversation"
            className={activeSection === "conversation" ? "active" : ""}
            aria-current={activeSection === "conversation" ? "page" : undefined}
          >
            自由对话
          </a>
          <a
            href="#/scenes"
            className={activeSection === "scenes" ? "active" : ""}
            aria-current={activeSection === "scenes" ? "page" : undefined}
          >
            场景训练
          </a>
          <a
            href="#/review"
            className={activeSection === "review" ? "active" : ""}
            aria-current={activeSection === "review" ? "page" : undefined}
          >
            学习资产
          </a>
        </nav>

        {state.user ? (
          <a
            className="user-entry"
            id="user-nav-entry"
            href="#/profile/overview"
            aria-label="进入个人中心"
          >
            <span className="user-avatar">{state.user.name[0]}</span>
            <span>{state.user.name}</span>
          </a>
        ) : (
          <a
            className="user-entry logged-out-entry"
            id="user-nav-entry"
            href="#/auth"
            aria-label="进入登录页面"
          >
            <span>登录 / 注册</span>
          </a>
        )}
      </header>

      <main id="app-root" className="app-root" data-route={route.name} tabIndex={-1} aria-live="polite">
        {renderView()}
      </main>

      <div id="toast" className={`toast ${toastShow ? "show" : ""}`} role="status" aria-live="polite">
        {toastMsg}
      </div>
    </div>
  );
}
