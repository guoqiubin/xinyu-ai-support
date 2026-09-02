"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  appendMessage,
  clearActiveSession,
  createId,
  createInitialSession,
  endSession,
  formatRemaining,
  getAvailableTags,
  getComingSoonTags,
  getUnsupportedTags,
  getRemainingSeconds,
  isSessionExpired,
  loadActiveSession,
  saveActiveSession
} from "@/lib/session-store";
import type { ChatResponse, ConsultationSession, Message } from "@/lib/types";

export default function ChatPage() {
  const router = useRouter();
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [session, setSession] = useState<ConsultationSession | null>(null);
  const [draft, setDraft] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [remaining, setRemaining] = useState(50 * 60);
  const [notice, setNotice] = useState<string | null>(null);

  const availableTags = useMemo(() => getAvailableTags(), []);
  const comingSoonTags = useMemo(() => getComingSoonTags(), []);
  const unsupportedTags = useMemo(() => getUnsupportedTags(), []);

  useEffect(() => {
    const existing = loadActiveSession();
    const active = existing?.status === "active" ? existing : createInitialSession();
    setSession(active);
    setSelectedTags(active.selectedTags);
    saveActiveSession(active);
  }, []);

  useEffect(() => {
    if (!session) return;
    saveActiveSession(session);
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session]);

  useEffect(() => {
    if (!session) return;

    const timer = window.setInterval(() => {
      const seconds = getRemainingSeconds(session);
      setRemaining(seconds);

      if (seconds <= 600 && !session.tenMinuteReminderShown && session.status === "active") {
        const note: Message = {
          id: createId("msg"),
          role: "system",
          type: "system_notice",
          content: "我们还剩大约 10 分钟，可以慢慢把今天最重要的部分收束一下。",
          createdAt: new Date().toISOString()
        };
        setSession((current) =>
          current
            ? {
                ...appendMessage(current, note),
                tenMinuteReminderShown: true
              }
            : current
        );
      }

      if (isSessionExpired(session) && session.status === "active") {
        finishSession("timeout");
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [session]);

  function updateSession(next: ConsultationSession) {
    setSession(next);
    saveActiveSession(next);
  }

  function toggleTag(tag: string) {
    setNotice(null);
    setSelectedTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]
    );
  }

  function confirmTags() {
    if (!session || selectedTags.length === 0) {
      setNotice("请先选择至少一个和当下状态接近的词。");
      return;
    }

    const next = {
      ...session,
      selectedTags,
      messages: [
        ...session.messages,
        {
          id: createId("msg"),
          role: "assistant" as const,
          content: `你选择了：${selectedTags.join("、")}。为了让这次咨询更聚焦，你想先从哪一个主题开始？`,
          createdAt: new Date().toISOString()
        }
      ]
    };
    updateSession(next);
  }

  function choosePrimaryTag(tag: string) {
    if (!session) return;
    const next = {
      ...session,
      primaryTag: tag,
      messages: [
        ...session.messages,
        {
          id: createId("msg"),
          role: "assistant" as const,
          content: `我们先从“${tag}”开始。最近一次这种感受明显出现，是在什么时候？当时发生了什么？`,
          createdAt: new Date().toISOString()
        }
      ]
    };
    updateSession(next);
  }

  async function sendMessage() {
    if (!session || !draft.trim() || isSending) return;

    const userMessage: Message = {
      id: createId("msg"),
      role: "user",
      content: draft.trim(),
      createdAt: new Date().toISOString()
    };

    const withUserMessage = appendMessage(session, userMessage);
    updateSession(withUserMessage);
    setDraft("");
    setIsSending(true);

    try {
      const responsePromise = fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session: withUserMessage,
          message: userMessage.content,
          remainingMinutes: Math.ceil(remaining / 60)
        })
      });
      const minimumDelay = wait(1300 + Math.floor(Math.random() * 1100));
      const [response] = await Promise.all([responsePromise, minimumDelay]);
      const data = (await response.json()) as ChatResponse;
      const next: ConsultationSession = {
        ...withUserMessage,
        status: data.sessionStatus,
        crisisDetected: data.riskTriggered || withUserMessage.crisisDetected,
        offTopicCount: data.offTopic ? withUserMessage.offTopicCount + 1 : 0,
        messages: [...withUserMessage.messages, data.assistantMessage]
      };
      updateSession(next);

      if (data.riskTriggered) {
        await finishSession("crisis", next);
      }
    } finally {
      setIsSending(false);
    }
  }

  async function finishSession(
    reason: NonNullable<ConsultationSession["endReason"]>,
    inputSession = session
  ) {
    if (!inputSession) return;
    const ended = endSession(inputSession, reason);
    updateSession(ended);

    const response = await fetch("/api/summaries/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session: ended })
    });
    const data = await response.json();
    updateSession({ ...ended, summary: data.summary });
    router.push(`/summary/${ended.id}`);
  }

  if (!session) {
    return (
      <main className="page-shell">
        <section className="content-card">正在进入咨询...</section>
      </main>
    );
  }

  const waitingForTags = session.selectedTags.length === 0;
  const waitingForPrimary = session.selectedTags.length > 0 && !session.primaryTag;
  const pausedForOffTopic = session.offTopicCount >= 2;

  return (
    <main className="chat-shell">
      <header className="chat-topbar">
        <div className="topbar-title">
          <strong>心屿</strong>
          <span>咨询中</span>
        </div>
        <span className="timer">剩余 {formatRemaining(remaining)}</span>
        <button className="secondary-button" onClick={() => setShowEndModal(true)}>
          结束
        </button>
      </header>

      <section className="messages">
        {session.messages.map((message) =>
          message.role === "system" ? (
            <div key={message.id} className="system-note">
              {message.content}
            </div>
          ) : (
            <div key={message.id} className={`message ${message.role}`}>
              <div className="bubble">{message.content}</div>
            </div>
          )
        )}

        {waitingForTags && (
          <div className="choice-panel">
            <div className="choice-grid">
              {availableTags.map((tag) => (
                <button
                  key={tag}
                  className={`tag-button ${selectedTags.includes(tag) ? "selected" : ""}`}
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </button>
              ))}
              {comingSoonTags.map((tag) => (
                <button
                  key={tag}
                  className="tag-button disabled"
                  onClick={() => setNotice("这个主题暂未开放。本次可以先从焦虑、压力、内耗、情绪低落或说不清开始。")}
                >
                  {tag} · 即将支持
                </button>
              ))}
              {unsupportedTags.map((tag) => (
                <button
                  key={tag}
                  className="tag-button"
                  onClick={() => setNotice("你的需求已收到，我们会在后续版本中评估和开发。1.0 版本可以先从焦虑、压力、内耗、情绪低落或说不清开始。")}
                >
                  {tag}
                </button>
              ))}
            </div>
            {notice && <p className="system-note">{notice}</p>}
            <div className="choice-actions">
              <button className="primary-button" onClick={confirmTags}>
                继续
              </button>
            </div>
          </div>
        )}

        {waitingForPrimary && (
          <div className="choice-panel">
            <div className="choice-grid">
              {session.selectedTags.map((tag) => (
                <button key={tag} className="tag-button" onClick={() => choosePrimaryTag(tag)}>
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}

        {pausedForOffTopic && (
          <div className="system-note">
            当前咨询已暂停。你可以重新输入和心理困扰相关的内容，或点击结束生成本次总结。
          </div>
        )}

        {isSending && (
          <div className="message assistant">
            <div className="bubble typing-bubble" aria-label="对方正在输入">
              <span>对方正在输入</span>
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </section>

      <footer className="composer">
        <textarea
          value={draft}
          disabled={waitingForTags || waitingForPrimary || isSending}
          placeholder={waitingForTags || waitingForPrimary ? "请先完成上方选择" : "输入你想说的话..."}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void sendMessage();
            }
          }}
        />
        <button className="primary-button" disabled={!draft.trim() || isSending} onClick={() => void sendMessage()}>
          发送
        </button>
      </footer>

      {showEndModal && (
        <div className="modal-backdrop">
          <div className="modal">
            <h2>结束咨询</h2>
            <p>确定结束本次咨询并生成总结吗？</p>
            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setShowEndModal(false)}>
                取消
              </button>
              <button className="primary-button" onClick={() => void finishSession("user_ended")}>
                确定结束
              </button>
            </div>
          </div>
        </div>
      )}

      {session.status !== "active" && !session.summary && (
        <div className="modal-backdrop">
          <div className="modal">
            <h2>正在整理</h2>
            <p>正在整理本次咨询内容，请稍等片刻。</p>
          </div>
        </div>
      )}
    </main>
  );
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
