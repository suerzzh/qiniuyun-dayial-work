import React from "react";
import PageHeading from "../components/PageHeading";
import Icon from "../components/Icon";
import { mockSessions } from "../data";

const sessionDialogueData = {
  cafe: {
    turns: [
      { sender: "Barista", text: "Would you like me to recommend something?" },
      { 
        sender: "You", 
        text: "I feel like to try something different today.", 
        correction: {
          original: "I feel like <del>to try</del> something different today.",
          corrected: "I feel like <ins>trying</ins> something different today.",
          note: "<strong>搭配纠错</strong>：feel like 后面应该接动名词 (doing)，不接动词不定式 (to do)。",
          native: "I'd love to try something new today.",
          pronunciation: "trying 中的 tr 发音要饱满紧凑，ing 弱读自然。"
        }
      },
      { sender: "Barista", text: "Sure — how about a medium oat milk latte?" },
      { 
        sender: "You", 
        text: "Could you recommend me something less sweet?", 
        correction: {
          original: "Could you <del>recommend me</del> something less sweet?",
          corrected: "Could you <ins>recommend</ins> something less sweet?",
          note: "<strong>用法纠错</strong>：recommend 是及物动词，其后直接加推荐的物品即可。不加宾语代词。",
          native: "Do you have anything that's not too sweet?",
          pronunciation: "Could you 可以进行同化连读为 /kʊdʒu/，recommend 的重音在发音末尾。"
        }
      }
    ]
  },
  hotel: {
    turns: [
      { sender: "Receptionist", text: "Welcome to Grand Plaza Hotel! Do you have a reservation under your name?" },
      { 
        sender: "You", 
        text: "Yes, I make reservation under Yufan.", 
        correction: {
          original: "Yes, I <del>make reservation</del> under Yufan.",
          corrected: "Yes, I <ins>made a reservation</ins> under Yufan.",
          note: "<strong>时态与冠词纠错</strong>：已经完成的动作应使用过去时 made；同时 reservation 为可数名词，需加冠词 a 或用复数。",
          native: "Yes, I have a booking under the name Yufan.",
          pronunciation: "reservation 的重音在第三音节 va /ˌrezəˈveɪʃn/，需特别注意。"
        }
      },
      { sender: "Receptionist", text: "Great. Can I see your ID and a credit card for the deposit?" },
      { 
        sender: "You", 
        text: "Sure, here is my card.", 
        correction: null
      }
    ]
  },
  airport: {
    turns: [
      { sender: "Officer", text: "Good morning. Can I see your passport and boarding pass, please?" },
      { 
        sender: "You", 
        text: "Sure, here is my pass and passport.", 
        correction: {
          original: "Sure, here is my <del>pass</del> and passport.",
          corrected: "Sure, here is my <ins>boarding pass</ins> and passport.",
          note: "<strong>词汇规范</strong>：航空登机卡应使用完整规范词汇 boarding pass，避免口语歧义。",
          native: "Sure, here you go.",
          pronunciation: "passport 中的 ss 音要弱读，boarding 中的 oa 发长音 /ɔː/。"
        }
      },
      { sender: "Officer", text: "Thank you. Are you checking any luggage today?" },
      { 
        sender: "You", 
        text: "Just this carry-on luggage.", 
        correction: null
      }
    ]
  }
};

export default function ReviewDetailView({ scene, state, updateState }) {
  const sceneId = scene || state.activeSessionId || "cafe";
  const activeSession = mockSessions.find((s) => s.id === sceneId) || mockSessions[0];
  const dialogue = sessionDialogueData[sceneId] || sessionDialogueData.cafe;

  return (
    <section className="standard-page review-detail-page view-enter">
      <PageHeading
        eyebrow=""
        title={`${activeSession.title} · 语境复现`}
        description="对话训练已完成，您可以在这里复盘对话语境下的纠错对比与地道表达推荐。"
        action={
          <div style={{ display: "flex", gap: "8px" }}>
            <a 
              className="primary-btn" 
              href={`#/training/${activeSession.id}/simulation?direct=true`}
              onClick={() => updateState({ isDirectSimulation: true, maxStage: "simulation", activeAsset: 0 })}
            >
              <Icon name="play" /> 复练场景
            </a>
            <a className="outline-btn" href="#/review">
              退出
            </a>
          </div>
        }
      />

      <div className="review-detail-layout" style={{ height: "calc(100% - 107px)", gridTemplateColumns: "1fr" }}>
        {/* Left side only: Context Turns and Inline AI Feedbacks */}
        <section className="context-panel panel" style={{ display: "flex", flexDirection: "column" }}>
          <div className="context-tabs">
            <button className="active" type="button">对话语境下的纠错与地道表达</button>
          </div>
          
          <div className="context-turns" style={{ flex: 1, overflowY: "auto", padding: "15px 19px" }}>
            {dialogue.turns.map((turn, tIdx) => {
              const isYou = turn.sender === "You";
              return (
                <div key={tIdx}>
                  <article className={`turn ${isYou ? "you" : "ai"}`} style={{ display: "flex", flexDirection: "column", alignItems: isYou ? "flex-end" : "flex-start", marginBottom: "12px" }}>
                    <span style={{ fontSize: "10px", color: "var(--quiet)", marginBottom: "3px" }}>{turn.sender}</span>
                    <p style={{ margin: 0, padding: "10px 14px", borderRadius: "12px", background: isYou ? "var(--soft)" : "#fafaf7", fontSize: "12px", border: "1px solid var(--line)" }}>
                      {turn.text}
                    </p>
                  </article>
                  
                  {turn.correction && (
                    <div className="grammar-correction-card inline-feedback-card" style={{ margin: "6px 0 16px 20px", padding: "14px 16px", borderLeft: "3px solid var(--accent)", background: "#fffbfb", borderRadius: "8px", border: "1px solid var(--line)", borderLeftWidth: "3px" }}>
                      <h4 style={{ margin: "0 0 10px", fontSize: "13px", color: "var(--ink)", display: "flex", alignItems: "center", gap: "6px", fontWeight: 700 }}>
                        <span>🤖 AI 语境评估反馈</span>
                      </h4>
                      <div className="corr-comparison" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <div className="corr-line original" style={{ fontSize: "12px", color: "var(--muted)", display: "flex", alignItems: "center" }}>
                          <span style={{ background: "#ffeef0", color: "#b31d28", padding: "2px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: "bold", marginRight: "8px", display: "inline-block" }}>表达纠错</span>
                          <span dangerouslySetInnerHTML={{ __html: turn.correction.original }}></span>
                        </div>
                        <div className="corr-line corrected" style={{ fontSize: "12px", color: "var(--ink)", marginTop: "4px", display: "flex", alignItems: "center" }}>
                          <span style={{ background: "#e6ffed", color: "#22863a", padding: "2px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: "bold", marginRight: "8px", display: "inline-block" }}>正确推荐</span>
                          <span dangerouslySetInnerHTML={{ __html: turn.correction.corrected }}></span>
                        </div>
                      </div>
                      <p style={{ margin: "10px 0 0", fontSize: "12px", color: "var(--muted)", lineHeight: 1.45 }} dangerouslySetInnerHTML={{ __html: turn.correction.note }}></p>
                      <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px dashed var(--line)", fontSize: "12px" }}>
                        <span style={{ color: "var(--blue)", fontWeight: "bold", marginRight: "6px" }}>💡 地道表达:</span>
                        <span style={{ color: "var(--ink)", fontStyle: "italic" }}>{turn.correction.native}</span>
                      </div>
                      <div style={{ marginTop: "6px", fontSize: "12px" }}>
                        <span style={{ color: "var(--orange)", fontWeight: "bold", marginRight: "6px" }}>🗣️ 发音诊断:</span>
                        <span style={{ color: "var(--muted)" }}>{turn.correction.pronunciation}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </section>
  );
}
