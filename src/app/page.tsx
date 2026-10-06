"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  clearActiveSession,
  createInitialSession,
  isSessionExpired,
  loadActiveSession,
  saveActiveSession,
  therapyOrientations
} from "@/lib/session-store";
import type { ConsultationSession, Gender, TherapyOrientation } from "@/lib/types";

export default function Home() {
  const router = useRouter();
  const [activeSession, setActiveSession] = useState<ConsultationSession | null>(null);
  const [age, setAge] = useState("26");
  const [gender, setGender] = useState<Gender>("other");
  const [orientation, setOrientation] = useState<TherapyOrientation>("integrative");
  const [formNotice, setFormNotice] = useState<string | null>(null);

  useEffect(() => {
    const existing = loadActiveSession();
    setActiveSession(existing?.status === "active" && !isSessionExpired(existing) ? existing : null);
  }, []);

  function startConsultation() {
    const numericAge = Number(age);
    if (!Number.isFinite(numericAge) || numericAge < 12 || numericAge > 99) {
      setFormNotice("请填写 12 到 99 岁之间的年龄。");
      return;
    }

    clearActiveSession();
    const session = createInitialSession({
      age: numericAge,
      gender,
      orientation
    });
    saveActiveSession(session);
    router.push("/chat");
  }

  return (
    <main className="page-shell home-shell">
      <section className="home-panel">
        <p className="eyebrow">心屿</p>
        <h1 className="hero-title">心屿 · AI 情绪支持助手</h1>
        <p className="hero-copy">当你感到焦虑、压力或内耗时，可以在这里慢慢说清楚。</p>

        <div className="notice">
          心屿提供 AI 情绪支持与自我梳理服务，不能替代真人心理咨询、心理治疗、精神科诊断或医疗服务。
        </div>

        <details className="notice">
          <summary>查看完整线上咨询须知</summary>
          <ul>
            <li>本服务用于帮助你梳理情绪、理解困扰和回顾当下处境。</li>
            <li>AI 咨询师不会进行诊断、治疗、用药建议或重大决策替代。</li>
            <li>如果你正在经历自伤、自杀、伤害他人的冲动，或处于紧急危险中，请立即联系现实中的可信任他人、当地紧急帮助，或前往最近医院/急诊。</li>
            <li>本次咨询默认 50 分钟。你可以提前结束咨询，结束后系统会整理一份回顾总结。</li>
            <li>请围绕心理困扰、情绪体验、人际压力、想法和行为模式表达。投资、法律、医疗、政治等问题不在服务范围内。</li>
            <li>匿名用户可以完整体验并导出当次长图；如需保存和管理历史总结，需要登录。</li>
          </ul>
        </details>

        <section className="intake-form" aria-label="开始前信息">
          <div className="form-section-header">
            <h2>开始前简单了解你</h2>
            <p>仅用于匹配默认头像和调整对话风格，不作为诊断或评估依据。</p>
          </div>

          <div className="form-grid">
            <label className="field-label">
              年龄
              <input
                min={12}
                max={99}
                inputMode="numeric"
                value={age}
                onChange={(event) => setAge(event.target.value)}
                placeholder="例如 26"
                type="number"
              />
            </label>

            <label className="field-label">
              性别
              <select value={gender} onChange={(event) => setGender(event.target.value as Gender)}>
                <option value="female">女性</option>
                <option value="male">男性</option>
                <option value="other">其他/暂不说明</option>
              </select>
            </label>
          </div>

          <div className="orientation-section">
            <div className="form-section-header compact">
              <h2>心理流派/取向</h2>
              <p>如果不确定，建议选择“整合取向”。</p>
            </div>
            <div className="orientation-grid">
              {therapyOrientations.map((item) => (
                <button
                  key={item.id}
                  className={`orientation-card ${orientation === item.id ? "selected" : ""}`}
                  onClick={() => setOrientation(item.id)}
                  type="button"
                >
                  <strong>{item.name}</strong>
                  <span>{item.description}</span>
                </button>
              ))}
            </div>
          </div>

          {formNotice && <p className="system-note">{formNotice}</p>}
        </section>

        <div className="home-actions">
          {activeSession ? (
            <>
              <button className="primary-button" onClick={() => router.push("/chat")}>
                继续上一次咨询
              </button>
              <button className="secondary-button" onClick={startConsultation}>
                我已阅读并同意，开始新话题
              </button>
            </>
          ) : (
            <button className="primary-button" onClick={startConsultation}>
              我已阅读并同意，开始咨询
            </button>
          )}
          <Link className="secondary-button" href="/history" style={{ display: "grid", placeItems: "center", textDecoration: "none" }}>
            查看历史总结
          </Link>
        </div>

        <footer className="footer-links">
          <Link href="/privacy">隐私政策</Link>
          <Link href="/terms">服务条款</Link>
        </footer>

        <section className="friend-links" aria-label="友情链接">
          <h2>友情链接</h2>
          <div>
            <a href="https://vercel-deploy-zeta-indol.vercel.app/#/tools/interview" target="_blank" rel="noreferrer">
              心理学硕博助手
            </a>
            <a href="https://new-chat-six-taupe.vercel.app/" target="_blank" rel="noreferrer">
              策略运营助手
            </a>
            <a href="https://cbst-dialogue-mvp.vercel.app/" target="_blank" rel="noreferrer">
              CBST 对话工具
            </a>
            <a href="https://intelligent-writing-advisor.vercel.app/" target="_blank" rel="noreferrer">
              智能写作助手
            </a>
          </div>
        </section>
      </section>
    </main>
  );
}
