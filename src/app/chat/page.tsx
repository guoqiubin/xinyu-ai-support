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
  getNextPhase,
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
  const [endIntent, setEndIntent] = useState<ChatResponse["endIntent"] | null>(null);
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
      phase: "intake" as const,
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

  function skipCurrentStep() {
    if (!session || waitingForTags || waitingForPrimary || isSending) return;

    const nextPhase = getNextPhase(session.phase);
    const assistantMessage: Message = {
      id: createId("msg"),
      role: "assistant",
      content: buildSkipMessage(session.phase, nextPhase),
      createdAt: new Date().toISOString()
    };

    updateSession({
      ...appendMessage(session, assistantMessage),
      phase: nextPhase
    });
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
      const shouldAdvanceToFormulation =
        data.assistantMessage.content.includes("当前信息收集完毕") && withUserMessage.phase === "intake";
      const next: ConsultationSession = {
        ...withUserMessage,
        status: data.sessionStatus,
        phase: shouldAdvanceToFormulation ? "formulation" : withUserMessage.phase,
        crisisDetected: data.riskTriggered || withUserMessage.crisisDetected,
        offTopicCount: data.offTopic ? withUserMessage.offTopicCount + 1 : 0,
        messages: [...withUserMessage.messages, data.assistantMessage]
      };
      updateSession(next);

      if (data.endIntent?.detected) {
        setEndIntent(data.endIntent);
      }

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
  const canSkipStep =
    !waitingForTags && !waitingForPrimary && session.status === "active" && !isSending && !endIntent;
  const inputDisabled = waitingForTags || waitingForPrimary || isSending || Boolean(endIntent);

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
            <ChatMessage key={message.id} message={message} session={session} />
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
            <AvatarImage
              alt="咨询师头像"
              className="assistant-avatar"
              fallback="咨"
              src={session.therapistProfile.avatarUrl}
            />
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

      {canSkipStep && (
        <button className="floating-skip-button" onClick={skipCurrentStep} type="button">
          跳过当前步骤
        </button>
      )}

      <footer className="composer">
        <textarea
          value={draft}
          disabled={inputDisabled}
          placeholder={
            endIntent
              ? "已识别到结束意向，请先选择是否完成本次咨询"
              : waitingForTags || waitingForPrimary
                ? "请先完成上方选择"
                : "输入你想说的话..."
          }
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void sendMessage();
            }
          }}
        />
        <button className="primary-button" disabled={!draft.trim() || isSending || Boolean(endIntent)} onClick={() => void sendMessage()}>
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

      {endIntent && (
        <div className="modal-backdrop">
          <div className="modal">
            <h2>{endIntent.type === "negative" ? "先停下来" : "完成本次咨询"}</h2>
            <p>
              {endIntent.type === "negative"
                ? "我识别到你可能不想继续，或这段对话让你感到不舒服。你可以现在完成本次咨询并生成总结，也可以取消后继续。"
                : "我识别到你想把今天先停在这里。可以现在完成本次咨询，并生成本次总结。"}
            </p>
            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setEndIntent(null)}>
                继续聊一会儿
              </button>
              <button
                className={endIntent.type === "negative" ? "danger-button" : "primary-button"}
                onClick={() => void finishSession("user_ended")}
              >
                完成咨询并生成总结
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

function ChatMessage({ message, session }: { message: Message; session: ConsultationSession }) {
  const isUser = message.role === "user";
  const avatar = (
    <AvatarImage
      alt={isUser ? "来访者头像" : "咨询师头像"}
      className={isUser ? "user-avatar" : "assistant-avatar"}
      fallback={isUser ? "访" : "咨"}
      src={isUser ? session.visitorProfile.avatarUrl : session.therapistProfile.avatarUrl}
    />
  );

  return (
    <div className={`message ${message.role}`}>
      {!isUser && avatar}
      <div className="bubble">{message.content}</div>
      {isUser && avatar}
    </div>
  );
}

function AvatarImage({
  alt,
  className,
  fallback,
  src
}: {
  alt: string;
  className: string;
  fallback: string;
  src: string;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <div aria-label={alt} className={`avatar ${className}`} role="img">
      {failed ? (
        <span>{fallback}</span>
      ) : (
        <img alt="" src={src} onError={() => setFailed(true)} />
      )}
    </div>
  );
}

function buildSkipMessage(currentPhase: ConsultationSession["phase"], nextPhase: ConsultationSession["phase"]) {
  if (currentPhase === "intake") {
    return "好的，我们先不继续收集细节，进入下一步。接下来我会把你已经说到的内容整理成一个初步理解：情境里发生了什么、你怎么理解它、它带来了哪些情绪/身体反应，以及你后来怎么应对。";
  }

  if (currentPhase === "formulation") {
    return "可以，我们先不继续分析这条链条，进入探索阶段。接下来会更关注你想要的变化、已有资源，以及一个足够小、不会给你增加负担的下一步。";
  }

  if (currentPhase === "exploration") {
    return "好的，我们进入收束阶段。接下来我会帮你回顾今天最重要的理解、仍然可以继续探索的部分，以及你愿意带走的一点点方向。";
  }

  return nextPhase === "closing"
    ? "我们已经在收束阶段了。你可以继续补充，也可以点击结束咨询生成本次总结。"
    : "好的，我们进入下一步。";
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
