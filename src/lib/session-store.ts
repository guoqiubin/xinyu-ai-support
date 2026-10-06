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

  return {
    age: normalizedAge,
    gender,
    ageGroup,
    avatarUrl: buildVisitorAvatar(gender, ageGroup)
  };
}

export function createTherapistProfile(orientation: TherapyOrientation = "integrative"): TherapistProfile {
  return {
    orientation,
    avatarUrl: buildTherapistAvatar(orientation)
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
  const visitorProfile = normalizeVisitorProfile(session.visitorProfile);
  const therapistProfile = normalizeTherapistProfile(session.therapistProfile);

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

function normalizeVisitorProfile(profile?: Partial<VisitorProfile>): VisitorProfile {
  const age = profile?.age ?? 26;
  const gender = profile?.gender ?? "other";
  return createVisitorProfile(age, gender);
}

function normalizeTherapistProfile(profile?: Partial<TherapistProfile>): TherapistProfile {
  return createTherapistProfile(profile?.orientation ?? "integrative");
}

function buildVisitorAvatar(gender: Gender, ageGroup: VisitorProfile["ageGroup"]) {
  const palette = getVisitorPalette(gender, ageGroup);
  return svgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img" aria-label="visitor avatar">
      <rect width="96" height="96" rx="48" fill="${palette.bg}"/>
      <path d="M18 86c3-17 15-27 30-27s27 10 30 27" fill="${palette.clothes}"/>
      <circle cx="48" cy="42" r="22" fill="${palette.skin}"/>
      <path d="${palette.hairPath}" fill="${palette.hair}"/>
      <circle cx="39" cy="43" r="2.3" fill="#302a25"/>
      <circle cx="57" cy="43" r="2.3" fill="#302a25"/>
      <path d="M40 54c4 4 12 4 16 0" fill="none" stroke="#6f5141" stroke-width="3" stroke-linecap="round"/>
      <path d="M23 86c5-11 14-17 25-17s20 6 25 17" fill="${palette.clothesShade}" opacity="0.55"/>
    </svg>
  `);
}

function buildTherapistAvatar(orientation: TherapyOrientation) {
  const palette = getTherapistPalette(orientation);
  return svgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img" aria-label="therapist avatar">
      <rect width="96" height="96" rx="48" fill="${palette.bg}"/>
      <path d="M18 88c3-18 15-29 30-29s27 11 30 29" fill="${palette.clothes}"/>
      <circle cx="48" cy="42" r="22" fill="#f1c9aa"/>
      <path d="M26 39c2-16 13-25 28-23 12 2 20 12 18 27-5-9-14-13-25-13-9 0-16 3-21 9Z" fill="#5f5247"/>
      <path d="M29 43c4-8 11-12 20-12 8 0 14 3 19 9" fill="none" stroke="#77695f" stroke-width="5" stroke-linecap="round"/>
      <circle cx="39" cy="44" r="2.2" fill="#302a25"/>
      <circle cx="57" cy="44" r="2.2" fill="#302a25"/>
      <path d="M40 55c4 4 12 4 16 0" fill="none" stroke="#725546" stroke-width="3" stroke-linecap="round"/>
      <path d="M36 67h24l-4 21H40Z" fill="#fff8ee" opacity="0.92"/>
      <path d="M25 88c5-11 13-17 23-17s18 6 23 17" fill="${palette.accent}" opacity="0.42"/>
    </svg>
  `);
}

function getVisitorPalette(gender: Gender, ageGroup: VisitorProfile["ageGroup"]) {
  const skin = ageGroup === "teen" ? "#f4c7aa" : ageGroup === "older_adult" ? "#e8b98f" : "#efc09c";
  const base = {
    male: {
      bg: "#e5eee8",
      hair: ageGroup === "older_adult" ? "#8b8379" : "#4f4038",
      clothes: "#5f7f72",
      clothesShade: "#426459",
      skin,
      hairPath:
        ageGroup === "teen"
          ? "M25 39c2-15 13-24 27-22 12 2 19 10 20 23-10-7-22-9-34-5-5 2-9 3-13 4Z"
          : "M25 40c1-16 12-25 27-24 13 1 21 11 21 25-8-8-20-11-34-7-5 2-9 4-14 6Z"
    },
    female: {
      bg: "#f2e8dc",
      hair: ageGroup === "older_adult" ? "#8c857b" : "#5c4639",
      clothes: "#7b6f8f",
      clothesShade: "#5f5574",
      skin,
      hairPath:
        ageGroup === "teen"
          ? "M23 49c0-20 10-32 26-32 15 0 25 11 25 31-7-11-16-16-27-16-10 0-18 6-24 17Z"
          : "M22 52c0-21 10-35 27-35 16 0 26 12 26 35-6-13-15-19-27-19-11 0-20 6-26 19Z"
    },
    other: {
      bg: "#f0eadf",
      hair: ageGroup === "older_adult" ? "#8b8379" : "#594b43",
      clothes: "#6f817b",
      clothesShade: "#566a64",
      skin,
      hairPath:
        "M25 41c2-16 13-25 28-24 13 1 21 11 20 25-8-7-18-10-31-8-7 1-12 4-17 7Z"
    }
  };

  return base[gender];
}

function getTherapistPalette(orientation: TherapyOrientation) {
  const palettes: Record<TherapyOrientation, { bg: string; clothes: string; accent: string }> = {
    integrative: { bg: "#efe5d6", clothes: "#6b7d73", accent: "#ddcdb8" },
    cbt: { bg: "#e5eee8", clothes: "#5f7f72", accent: "#cbdcd2" },
    humanistic: { bg: "#f3e4d9", clothes: "#806d61", accent: "#e7cbbb" },
    psychodynamic: { bg: "#ebe6ef", clothes: "#726985", accent: "#d8d0e4" },
    solution_focused: { bg: "#eef0df", clothes: "#74805d", accent: "#dce0be" },
    mindfulness: { bg: "#e4ece9", clothes: "#627d7a", accent: "#cbded9" }
  };

  return palettes[orientation];
}

function svgDataUri(svg: string) {
  const compactSvg = svg.replace(/\s+/g, " ").trim();
  return `data:image/svg+xml;utf8,${encodeURIComponent(compactSvg)}`;
}
