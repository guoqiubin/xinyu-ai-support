"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { clearHistory, deleteHistoryItem, loadHistory } from "@/lib/session-store";
import type { Summary } from "@/lib/types";

export default function HistoryPage() {
  const [history, setHistory] = useState<Summary[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  function remove(sessionId: string) {
    deleteHistoryItem(sessionId);
    setHistory(loadHistory());
  }

  function clearAll() {
    clearHistory();
    setHistory([]);
    setConfirmClear(false);
  }

  return (
    <main className="page-shell">
      <section className="content-card">
        <h1>历史总结</h1>
        <p>正式版本中，登录后可查看和管理你的历史总结。当前 MVP 先使用本浏览器本地历史验证体验。</p>

        {history.length === 0 ? (
          <div className="notice">还没有历史总结。完成一次咨询并保存后，会出现在这里。</div>
        ) : (
          <>
            {history.map((item) => (
              <article className="summary-section" key={item.sessionId}>
                <h2>{new Date(item.createdAt).toLocaleString("zh-CN")}</h2>
                <p>{item.oneLineSummary}</p>
                <div className="summary-actions">
                  <button className="danger-button" onClick={() => remove(item.sessionId)}>
                    删除
                  </button>
                </div>
              </article>
            ))}
            <div className="summary-actions">
              <button className="danger-button" onClick={() => setConfirmClear(true)}>
                清空全部记录
              </button>
            </div>
          </>
        )}

        <div className="summary-actions">
          <Link className="secondary-button" href="/" style={{ display: "grid", placeItems: "center", textDecoration: "none" }}>
            返回首页
          </Link>
        </div>
      </section>

      {confirmClear && (
        <div className="modal-backdrop">
          <div className="modal">
            <h2>清空全部记录</h2>
            <p>清空后将删除所有咨询总结及对应聊天记录，且无法恢复。是否确认清空？</p>
            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setConfirmClear(false)}>
                取消
              </button>
              <button className="danger-button" onClick={clearAll}>
                确认清空
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
