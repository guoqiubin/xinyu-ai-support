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
