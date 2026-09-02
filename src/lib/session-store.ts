"use client";

import type { ConsultationSession, Message, Summary } from "./types";

const ACTIVE_SESSION_KEY = "xinyu.activeSession";
const HISTORY_KEY = "xinyu.history";

const availableTags = ["焦虑", "压力", "内耗", "情绪低落", "说不清"];

export function createId(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function createInitialSession(): ConsultationSession {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 50 * 60 * 1000);

  return {
    id: createId("session"),
    status: "active",
    selectedTags: [],
    primaryTag: null,
    startedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    offTopicCount: 0,
    crisisDetected: false,
    tenMinuteReminderShown: false,
    messages: [
      {
        id: createId("msg"),
        role: "assistant",
        content:
          "这次我们有 50 分钟。你可以先选几个和当下状态最接近的词，我会再陪你聚焦一个最想聊的部分。",
        createdAt: now.toISOString()
      }
    ]
  };
}

export function getAvailableTags() {
  return availableTags;
}

export function getComingSoonTags() {
  return ["睡眠困扰", "工作学习", "人际关系", "亲密关系", "家庭关系"];
}

export function getUnsupportedTags() {
  return ["其他"];
}

export function loadActiveSession(): ConsultationSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(ACTIVE_SESSION_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as ConsultationSession;
  } catch {
    window.localStorage.removeItem(ACTIVE_SESSION_KEY);
    return null;
  }
}

export function saveActiveSession(session: ConsultationSession) {
  window.localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
}

export function clearActiveSession() {
  window.localStorage.removeItem(ACTIVE_SESSION_KEY);
}

export function loadHistory(): Summary[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(HISTORY_KEY);
  if (!raw) return [];

  try {
    return JSON.parse(raw) as Summary[];
  } catch {
    window.localStorage.removeItem(HISTORY_KEY);
    return [];
  }
}

export function saveSummaryToHistory(summary: Summary) {
  const history = loadHistory().filter((item) => item.sessionId !== summary.sessionId);
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify([summary, ...history]));
}

export function deleteHistoryItem(sessionId: string) {
  const history = loadHistory().filter((item) => item.sessionId !== sessionId);
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

export function clearHistory() {
  window.localStorage.removeItem(HISTORY_KEY);
}

export function appendMessage(session: ConsultationSession, message: Message) {
  return {
    ...session,
    messages: [...session.messages, message]
  };
}

export function getRemainingSeconds(session: ConsultationSession) {
  const diff = new Date(session.expiresAt).getTime() - Date.now();
  return Math.max(0, Math.floor(diff / 1000));
}

export function formatRemaining(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${rest.toString().padStart(2, "0")}`;
}

export function isSessionExpired(session: ConsultationSession) {
  return getRemainingSeconds(session) <= 0;
}

export function endSession(
  session: ConsultationSession,
  reason: NonNullable<ConsultationSession["endReason"]>
): ConsultationSession {
  return {
    ...session,
    status: reason === "timeout" ? "expired" : reason === "crisis" ? "crisis_ended" : "ended",
    endReason: reason,
    endedAt: new Date().toISOString()
  };
}
