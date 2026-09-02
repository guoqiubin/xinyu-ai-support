import { NextResponse } from "next/server";
import type { ConsultationSession, Message, Summary } from "@/lib/types";

export async function POST(request: Request) {
  const body = (await request.json()) as { session: ConsultationSession };
  const session = body.session;
  const userMessages = session.messages.filter((message) => message.role === "user");
  const quotes = selectQuotes(userMessages);
  const primaryTag = session.primaryTag ?? session.selectedTags[0] ?? "当下困扰";

  const summary: Summary = {
    id: `summary_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    sessionId: session.id,
    mainConcern:
      session.endReason === "crisis"
        ? "本次对话中出现了可能涉及安全风险的表达，因此普通咨询已停止。"
        : `本次主要围绕“${primaryTag}”展开，重点是帮助你把模糊的不适放回具体情境中理解。`,
    keySituation:
      quotes[0] ??
      "目前还缺少足够具体的事件信息。后续可以继续从最近一次明显感受到困扰的场景开始梳理。",
    mainEmotions:
      session.selectedTags.length > 0
        ? `你选择的状态包括：${session.selectedTags.join("、")}。这些词可以作为理解本次体验的入口。`
        : "本次尚未形成明确的情绪标签。",
    thoughts:
      "对话中更适合继续观察的是：当事件发生时，你脑中第一时间冒出的判断、担心或自我评价是什么。这里不做诊断，只作为后续理解自己的线索。",
    explorationDirection:
      session.endReason === "crisis"
        ? "请优先联系现实中的可信任他人或当地紧急帮助，确保当前安全。"
        : "后续可以继续围绕具体事件、当时想法、情绪强度、身体反应和行为选择来梳理。",
    keyQuotes: quotes.length > 0 ? quotes : ["本次对话中的用户表达较少，暂未形成可引用的关键片段。"],
    oneLineSummary:
      session.endReason === "crisis"
        ? "本次对话因安全风险触发而提前结束。"
        : `这次主要围绕${primaryTag}及其相关情境进行初步梳理。`,
    createdAt: new Date().toISOString()
  };

  return NextResponse.json({ summary });
}

function selectQuotes(messages: Message[]) {
  return messages
    .map((message) => desensitize(message.content))
    .filter((content) => content.length >= 6)
    .slice(-3);
}

function desensitize(content: string) {
  return content
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[邮箱]")
    .replace(/1[3-9]\d{9}/g, "[手机号]")
    .replace(/[\u4e00-\u9fa5]{2,4}公司/g, "[公司]");
}
