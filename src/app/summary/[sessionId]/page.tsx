"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearActiveSession, deleteHistoryItem, loadActiveSession, saveSummaryToHistory } from "@/lib/session-store";
import { exportSummaryImage } from "@/lib/export-image";
import type { ConsultationSession, Summary } from "@/lib/types";

export default function SummaryPage() {
  const router = useRouter();
  const [session, setSession] = useState<ConsultationSession | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const active = loadActiveSession();
    setSession(active);
    setSummary(active?.summary ?? null);
  }, []);

  if (!summary) {
    return (
      <main className="page-shell">
        <section className="content-card">
          <h1>正在整理</h1>
          <p>正在整理本次咨询内容，请稍等片刻。</p>
          <Link className="text-button" href="/chat">
            返回咨询
          </Link>
        </section>
      </main>
    );
  }

  function deleteCurrent() {
    if (!session) return;
    deleteHistoryItem(session.id);
    clearActiveSession();
    router.push("/");
  }

  function saveHistory() {
    if (!summary) return;
    saveSummaryToHistory(summary);
    setSaved(true);
  }

  return (
    <main className="page-shell">
      <article className="summary-card">
        <h1>咨询回顾</h1>
        <p className="eyebrow">{new Date(summary.createdAt).toLocaleString("zh-CN")}</p>

        <SummarySection title="本次主要困扰" body={summary.mainConcern} />
        <SummarySection title="关键情境" body={summary.keySituation} />
        <SummarySection title="主要情绪" body={summary.mainEmotions} />
        <SummarySection title="当时的想法" body={summary.thoughts} />
        <SummarySection title="可继续探索的方向" body={summary.explorationDirection} />

        <section className="summary-section">
          <h2>关键对话片段</h2>
          <ul>
            {summary.keyQuotes.map((quote, index) => (
              <li key={`${quote}-${index}`}>{quote}</li>
            ))}
          </ul>
        </section>

        <div className="notice">
          匿名用户可以导出当次长图；如需保存和管理历史总结，可在后续接入邮箱登录后保存。
        </div>

        <div className="summary-actions">
          <button className="primary-button" onClick={() => exportSummaryImage(summary)}>
            导出长图
          </button>
          <button className="secondary-button" onClick={saveHistory}>
            {saved ? "已保存到本地历史" : "保存到本地历史"}
          </button>
          <button className="danger-button" onClick={() => setShowDelete(true)}>
            删除本次
          </button>
          <Link className="secondary-button" href="/" style={{ display: "grid", placeItems: "center", textDecoration: "none" }}>
            返回首页
          </Link>
        </div>
      </article>

      {showDelete && (
        <div className="modal-backdrop">
          <div className="modal">
            <h2>删除本次咨询</h2>
            <p>删除后将移除本次总结和当前会话记录，且无法恢复。</p>
            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setShowDelete(false)}>
                取消
              </button>
              <button className="danger-button" onClick={deleteCurrent}>
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function SummarySection({ title, body }: { title: string; body: string }) {
  return (
    <section className="summary-section">
      <h2>{title}</h2>
      <p>{body}</p>
    </section>
  );
}
