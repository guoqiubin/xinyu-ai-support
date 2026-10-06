export type Role = "user" | "assistant" | "system";

export type Message = {
  id: string;
  role: Role;
  content: string;
  createdAt: string;
  type?: "text" | "system_notice" | "crisis_notice";
};

export type Summary = {
  id: string;
  sessionId: string;
  mainConcern: string;
  keySituation: string;
  mainEmotions: string;
  thoughts: string;
  explorationDirection: string;
  keyQuotes: string[];
  oneLineSummary: string;
  createdAt: string;
};

export type Gender = "male" | "female" | "other";

export type TherapyOrientation =
  | "integrative"
  | "cbt"
  | "humanistic"
  | "psychodynamic"
  | "solution_focused"
  | "mindfulness";

export type ConsultationPhase = "intake" | "formulation" | "exploration" | "closing";

export type VisitorProfile = {
  age: number;
  gender: Gender;
  ageGroup: "teen" | "young_adult" | "adult" | "older_adult";
  avatarUrl: string;
};

export type TherapistProfile = {
  orientation: TherapyOrientation;
  avatarUrl: string;
};

export type SessionStatus =
  | "active"
  | "ended"
  | "expired"
  | "crisis_ended"
  | "summary_failed";

export type ConsultationSession = {
  id: string;
  status: SessionStatus;
  selectedTags: string[];
  primaryTag: string | null;
  phase: ConsultationPhase;
  visitorProfile: VisitorProfile;
  therapistProfile: TherapistProfile;
  startedAt: string;
  expiresAt: string;
  endedAt?: string;
  endReason?: "user_ended" | "timeout" | "crisis" | "new_topic" | "system";
  offTopicCount: number;
  crisisDetected: boolean;
  tenMinuteReminderShown: boolean;
  messages: Message[];
  rollingSummary?: string;
  summary?: Summary;
};

export type ChatResponse = {
  assistantMessage: Message;
  sessionStatus: SessionStatus;
  riskTriggered: boolean;
  offTopic: boolean;
};
