"use client";

import type {
  ConsultationPhase,
  ConsultationSession,
  Gender,
  Message,
  Summary,
  TherapyOrientation,
  TherapistProfile,
  VisitorProfile
} from "./types";

const ACTIVE_SESSION_KEY = "xinyu.activeSession";
const HISTORY_KEY = "xinyu.history";

const availableTags = ["焦虑", "压力", "内耗", "情绪低落", "说不清"];

export const therapyOrientations: Array<{
  id: TherapyOrientation;
  name: string;
  description: string;
}> = [
  {
    id: "integrative",
    name: "整合取向",
    description: "根据对话需要灵活结合不同方法，不严格限定表达风格。"
  },
  {
    id: "cbt",
    name: "认知行为取向",
    description: "关注情境、想法、情绪、身体反应和行为之间的关系。"
  },
  {
    id: "humanistic",
    name: "人本主义取向",
    description: "更强调接纳、共情、主体感和个人意义。"
  },
  {
    id: "psychodynamic",
    name: "心理动力取向",
    description: "温和探索关系模式、重复体验和深层情绪线索。"
  },
  {
    id: "solution_focused",
    name: "焦点解决取向",
    description: "更关注资源、例外经验、可行小步和未来目标。"
  },
  {
    id: "mindfulness",
    name: "正念/接纳取向",
    description: "帮助觉察当下体验，减少对情绪和想法的拉扯。"
  }
];

export function createId(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function createInitialSession(input?: {
  age?: number;
  gender?: Gender;
  orientation?: TherapyOrientation;
}): ConsultationSession {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 50 * 60 * 1000);
  const visitorProfile = createVisitorProfile(input?.age, input?.gender);
  const therapistProfile = createTherapistProfile(input?.orientation);

  return {
    id: createId("session"),
    status: "active",
    selectedTags: [],
    primaryTag: null,
    phase: "intake",
    visitorProfile,
    therapistProfile,
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

export function createVisitorProfile(age = 26, gender: Gender = "other"): VisitorProfile {
  const normalizedAge = Number.isFinite(age) ? Math.min(99, Math.max(12, Math.round(age))) : 26;
  const ageGroup = getAgeGroup(normalizedAge);
  const seed = `xinyu-visitor-${gender}-${ageGroup}-${normalizedAge}`;

  return {
    age: normalizedAge,
    gender,
    ageGroup,
    avatarUrl: buildDiceBearUrl("avataaars", seed)
  };
}

export function createTherapistProfile(orientation: TherapyOrientation = "integrative"): TherapistProfile {
  return {
    orientation,
    avatarUrl: buildDiceBearUrl("lorelei", `xinyu-therapist-${orientation}`)
  };
}

export function getOrientationName(orientation: TherapyOrientation) {
  return therapyOrientations.find((item) => item.id === orientation)?.name ?? "整合取向";
}

export function getNextPhase(phase: ConsultationPhase): ConsultationPhase {
  if (phase === "intake") return "formulation";
  if (phase === "formulation") return "exploration";
  if (phase === "exploration") return "closing";
  return "closing";
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
    return normalizeSession(JSON.parse(raw) as Partial<ConsultationSession>);
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

function normalizeSession(session: Partial<ConsultationSession>): ConsultationSession {
  const selectedTags = session.selectedTags ?? [];
  const visitorProfile = session.visitorProfile ?? createVisitorProfile();
  const therapistProfile = session.therapistProfile ?? createTherapistProfile();

  return {
    id: session.id ?? createId("session"),
    status: session.status ?? "active",
    selectedTags,
    primaryTag: session.primaryTag ?? null,
    phase: session.phase ?? "intake",
    visitorProfile,
    therapistProfile,
    startedAt: session.startedAt ?? new Date().toISOString(),
    expiresAt: session.expiresAt ?? new Date(Date.now() + 50 * 60 * 1000).toISOString(),
    endedAt: session.endedAt,
    endReason: session.endReason,
    offTopicCount: session.offTopicCount ?? 0,
    crisisDetected: session.crisisDetected ?? false,
    tenMinuteReminderShown: session.tenMinuteReminderShown ?? false,
    messages: session.messages ?? [],
    rollingSummary: session.rollingSummary,
    summary: session.summary
  };
}

function getAgeGroup(age: number): VisitorProfile["ageGroup"] {
  if (age < 18) return "teen";
  if (age < 30) return "young_adult";
  if (age < 60) return "adult";
  return "older_adult";
}

function buildDiceBearUrl(style: "avataaars" | "lorelei", seed: string) {
  const params = new URLSearchParams({
    seed,
    backgroundColor: "f7f2ea,e5eee8,fff8ee",
    radius: "50"
  });
  return `https://api.dicebear.com/10.x/${style}/svg?${params.toString()}`;
}
