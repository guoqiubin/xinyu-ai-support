import { NextResponse } from "next/server";
import type { ConsultationSession, Message } from "@/lib/types";

const crisisPatterns = [
  "我想死",
  "不想活了",
  "活着没意思",
  "结束生命",
  "想自杀",
  "割腕",
  "跳楼",
  "遗书",
  "吃很多药",
  "杀了",
  "伤害别人",
  "伤害他人",
  "手里有刀"
];

const nonPsychPatterns = [
  "股票",
  "基金",
  "投资",
  "理财",
  "法律",
  "律师",
  "起诉",
  "判刑",
  "吃什么药",
  "用药",
  "诊断",
  "政治",
  "选举"
];

const nonsensePatterns = ["哈哈哈", "测试", "忽略规则", "随便聊", "讲个笑话"];

function createMessage(content: string, type: Message["type"] = "text"): Message {
  return {
    id: `msg_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    role: "assistant",
    type,
    content,
    createdAt: new Date().toISOString()
  };
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    session: ConsultationSession;
    message: string;
    remainingMinutes: number;
  };

  const message = body.message.trim();

  if (crisisPatterns.some((pattern) => message.includes(pattern))) {
    return NextResponse.json({
      assistantMessage: createMessage(
        "我需要先把安全放在第一位。你刚才的表达里出现了可能涉及自伤、自杀或伤害他人的风险，这已经超出普通对话咨询的范围。请立刻联系现实中可信任的人，或寻求当地紧急帮助，也可以前往最近的医院/急诊。你现在最重要的是不要独自承受，并尽快让现实中的人知道你正处在危险里。",
        "crisis_notice"
      ),
      sessionStatus: "crisis_ended",
      riskTriggered: true,
      offTopic: false
    });
  }

  if (nonPsychPatterns.some((pattern) => message.includes(pattern))) {
    return NextResponse.json({
      assistantMessage: createMessage(
        "这个问题超出了心理支持范围，我不能提供投资、法律、医疗或具体决策建议。但如果这个问题背后带来了焦虑、压力或不安，我们可以一起看看这些感受。"
      ),
      sessionStatus: "active",
      riskTriggered: false,
      offTopic: true
    });
  }

  if (message.length < 3 || nonsensePatterns.some((pattern) => message.includes(pattern))) {
    const nextOffTopicCount = body.session.offTopicCount + 1;
    return NextResponse.json({
      assistantMessage: createMessage(
        nextOffTopicCount >= 2
          ? "当前咨询先暂停一下。我还没有捕捉到和心理困扰相关的信息。你可以重新输入最近最困扰你的一件事，或者点击结束生成本次总结。"
          : "我还没有捕捉到和心理困扰相关的信息。你可以说说最近最困扰你的一件事，或者现在最明显的情绪是什么。"
      ),
      sessionStatus: "active",
      riskTriggered: false,
      offTopic: true
    });
  }

  const transitionReply = maybeBuildIntakeTransitionReply(body.session, message);
  if (transitionReply) {
    return NextResponse.json({
      assistantMessage: createMessage(transitionReply),
      sessionStatus: "active",
      riskTriggered: false,
      offTopic: false
    });
  }

  const modelReply = await tryCreateModelReply(body.session, message, body.remainingMinutes);
  const content = modelReply ?? buildSupportiveReply(message, body.session, body.remainingMinutes);

  return NextResponse.json({
    assistantMessage: createMessage(content),
    sessionStatus: "active",
    riskTriggered: false,
    offTopic: false
  });
}

async function tryCreateModelReply(
  session: ConsultationSession,
  message: string,
  remainingMinutes: number
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content: buildSystemPrompt(session, remainingMinutes)
          },
          ...session.messages.slice(-12).map((item) => ({
            role: item.role === "assistant" ? "assistant" : "user",
            content: item.content
          })),
          {
            role: "user",
            content: message
          }
        ],
        temperature: 0.7,
        max_output_tokens: 520
      })
    });

    if (!response.ok) return null;
    const data = await response.json();
    const text = extractResponseText(data);
    return text ? sanitizeAssistantReply(text) : null;
  } catch {
    return null;
  }
}

function buildSystemPrompt(session: ConsultationSession, remainingMinutes: number) {
  const topic = session.primaryTag ?? session.selectedTags[0] ?? "当下困扰";
  return `你是“心屿”的 AI 情绪支持助手。你提供心理支持和自我梳理，不替代真人心理咨询、心理治疗、精神科诊断或医疗服务。

当前主题：${topic}
已选标签：${session.selectedTags.join("、") || "未选择"}
剩余时间：约 ${remainingMinutes} 分钟
当前对话阶段判断：${buildStageGuidance(session)}

你只能回复心理支持、情绪梳理、心理咨询过程相关内容。
遇到投资、法律、医疗诊断、用药、政治、具体重大决策等问题，要解释边界并拉回其背后的情绪。
遇到自杀、自伤、伤害他人或紧急危险表达，要停止普通咨询并要求用户立刻联系现实帮助。

咨询风格：
- 像一个通用大模型，但被限定在心理支持和咨询对话范围内。
- 使用 CBT 和人本主义取向：倾听、澄清、具体化、反映感受、探索事件-想法-情绪-身体-行为。
- 不要每轮都共情，不要模板化。
- 不要诊断，不要贴标签，不要说“你是典型的……”。
- 用户说“怎么办”时，不要机械拒绝；先承接痛苦，再说明不能替用户决定，并帮助梳理处境、感受、担心和看重的东西。
- 必须读懂用户上一轮已经回答了什么，不要重复同一个问题。
- 如果刚刚问过“最近一次什么时候发生/发生了什么”，而用户已经描述了失恋、暗恋、关系结束、被忽视等内容，就继续探索担心、情绪强度、身体反应或关系意义，不要再问同一句。
- 信息收集不是无限追问。连续具体化 3 轮左右，且已经得到“主题/影响/时间线/关系或触发线索”中的至少两类信息时，必须主动收束：“当前信息收集完毕，可以进入下一个步骤。你觉得这样可行吗？”不要继续追问细节。
- 如果已经提示进入下一步，用户表示同意或继续，就转入初步理解：帮助用户整理“情境-想法-情绪/身体-行为”链条，或邀请用户选择最想先看的部分。
- 每次最多问 1 个核心问题。严格只输出一个问句，不要连续抛出多个问号。
- 回复 2 到 5 句话。`;
}

function buildStageGuidance(session: ConsultationSession) {
  if (hasOfferedIntakeTransition(session)) {
    return "已完成信息收集收束。下一轮应进入初步理解或 CBT 链条整理，不要回到连续追问。";
  }

  const intakeTurns = countUserIntakeTurns(session);
  const signalCount = countInformationSignals(session);
  if (intakeTurns >= 3 && signalCount >= 2) {
    return "信息已经足够进入下一步。请主动收束信息收集，邀请用户确认进入初步理解/整理阶段。";
  }

  return "仍可适度具体化，但不要连续抛出多个问题。";
}

function extractResponseText(data: unknown) {
  if (!data || typeof data !== "object") return null;
  const maybeOutputText = (data as { output_text?: unknown }).output_text;
  if (typeof maybeOutputText === "string") return maybeOutputText;

  const output = (data as { output?: unknown }).output;
  if (!Array.isArray(output)) return null;

  const chunks: string[] = [];
  for (const item of output) {
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      const text = (part as { text?: unknown }).text;
      if (typeof text === "string") chunks.push(text);
    }
  }

  return chunks.join("").trim() || null;
}

function sanitizeAssistantReply(reply: string) {
  return reply
    .replace(/你(是|属于|这是)典型的/g, "这可能有一点像")
    .replace(/初步诊断为/g, "可以暂时理解为")
    .trim();
}

function buildSupportiveReply(
  message: string,
  session: ConsultationSession,
  remainingMinutes: number
) {
  const topic = session.primaryTag ?? session.selectedTags[0] ?? "这种感受";
  const assistantMessages = session.messages.filter((item) => item.role === "assistant");
  const userMessageCount = session.messages.filter((item) => item.role === "user").length;
  const lastAssistant = assistantMessages.at(-1)?.content ?? "";
  const normalized = message.replace(/\s/g, "");

  const transitionReply = maybeBuildIntakeTransitionReply(session, message);
  if (transitionReply) return transitionReply;

  if (message.includes("怎么办") || message.includes("建议") || message.includes("你告诉我")) {
    if (hasRelationshipContext(message, session)) {
      return "失恋或暗恋里的不被回应，确实很容易让人把关系的结束和“自己不被在意”连在一起。这里我不能直接替你决定要不要继续联系对方，但我们可以先把这份失落看清楚：你最难受的是关系可能结束，还是“对方不理我”带来的被忽视感？";
    }

    return "我不能直接替你决定该怎么做，因为这个决定需要回到你的处境、感受和价值排序里。我们可以先把几个可能选项、你担心的后果，以及你真正看重的东西梳理出来。眼下这件事里，你最害怕发生的结果是什么？";
  }

  if (normalized.includes("刚说了") || normalized.includes("说过了") || normalized.includes("重复")) {
    return "你说得对，这里不该一直停在同一个问题上。我们把你刚才说的先放在这里：你注意到自己很难放松、总是紧张。接下来不再追问同一个想法，我们换一个角度看：这种紧张出现时，身体上最明显的反应是什么？比如胸口发紧、胃不舒服、肩颈绷着，还是脑子停不下来？";
  }

  if (hasRelationshipContext(message, session)) {
    if (lastAssistant.includes("最近一次")) {
      return "我先把你说的放在这里：这次情绪低落和一段没有得到回应的关系有关，里面有失落，也有对关系结束的担心。我们不急着判断你该怎么做，先看这份失落本身。此刻最刺痛你的部分是“对方不理我”，还是“这段关系可能没有结果”？";
    }

    if (lastAssistant.includes("最害怕发生的结果")) {
      return "听起来你最担心的是关系真的走向结束，这里面有一种被悬着、也有失落。我们先不急着讨论要不要联系对方，而是把这个担心说清楚：如果这段关系结束，对你来说最难承受的意义是什么？";
    }

    return "我听到的是，这件事不只是“对方有没有回应”，也牵动了你对自己是否重要、关系是否会结束的感受。我们可以先不急着处理行动层面，回到你自己这里：当你想到“对方不理我”时，你脑中最容易冒出来的一句话是什么？";
  }

  if (message.length < 18) {
    if (lastAssistant.includes("自动化想法") || lastAssistant.includes("第一反应")) {
      return "我先按你刚才说的理解：那一刻更明显的是一种持续的紧张和无法放松。我们不强迫它变成一句标准答案。接下来可以看情绪和身体反应：如果用 0 到 10 分表示，当时这种紧张大概有几分？身体哪里最明显？";
    }

    return `我先不急着判断。围绕“${topic}”，我们可以把它放回一个具体场景里看：最近一次这种感受明显出现，是在什么时候？当时发生了什么？`;
  }

  if (remainingMinutes <= 10) {
    return "我们可以慢慢收束到今天最重要的部分。刚才你描述的情境里，最触动你的似乎不是单一事件，而是它带来的某种判断或担心。此刻如果只选一个最想带走的理解，你会希望先看清哪一部分？";
  }

  if (lastAssistant.includes("最近一次") || userMessageCount <= 1) {
    if (hasRelationshipContext(message, session)) {
      return "我先把你说的放在这里：这次情绪低落和一段没有得到回应的关系有关，里面有失落，也有对关系结束的担心。我们不急着判断你该怎么做，先看这份失落本身。此刻最刺痛你的部分是“他不理我”，还是“这段关系可能没有结果”？";
    }

    return "我听到这里，先把它理解成一个具体情境里的压力反应，而不是急着给它下结论。为了让这件事更清楚，我们可以先看当时脑中第一时间冒出来的想法，也就是 CBT 里说的“自动化想法”。那一刻，你对自己、对别人或对结果的第一反应是什么？";
  }

  if (
    lastAssistant.includes("自动化想法") ||
    lastAssistant.includes("第一反应") ||
    message.includes("自动化想法") ||
    message.includes("我为什么") ||
    message.includes("无法放松") ||
    message.includes("紧张")
  ) {
    return "这已经是一个很有用的线索：你注意到的不是单个念头，而是一种“我为什么总是这样”的自我追问。我们先不把它变成对自己的评价。更具体地看，当这种紧张出现时，情绪强度大概是 0 到 10 分里的几分？身体上最明显的反应在哪里？";
  }

  if (lastAssistant.includes("情绪强度") || lastAssistant.includes("身体")) {
    return "好，我们把情绪和身体反应也放进来了。下一步可以看行为：当这种紧张出现时，你通常会怎么做？比如反复准备、回避、拖延、找人确认，还是表面继续做但心里一直绷着？";
  }

  if (lastAssistant.includes("通常会怎么做") || lastAssistant.includes("行为")) {
    return "现在这条链条已经更清楚了：具体情境、当时的想法、情绪/身体反应，以及你会怎么应对。这里暂时不急着给建议。你觉得这条链条里，最消耗你的部分是哪一环？";
  }

  return "我先把你说的放回这次主题里看：这里有一个具体压力源，也有随之出现的紧张和自我要求。为了继续具体化，我们可以选一个入口：A 情绪强度，B 身体反应，C 当时行为，D 最担心的后果。你想先看哪一个？";
}

function hasRelationshipContext(message: string, session: ConsultationSession) {
  const text = [message, ...session.messages.slice(-8).map((item) => item.content)].join("\n");
  return ["失恋", "暗恋", "喜欢的人", "不理我", "关系结束", "分手", "他不回", "她不回"].some(
    (keyword) => text.includes(keyword)
  );
}

function maybeBuildIntakeTransitionReply(session: ConsultationSession, message: string) {
  if (hasOfferedIntakeTransition(session)) return null;
  if (countUserIntakeTurns(session) < 3) return null;
  if (countInformationSignals(session, message) < 2) return null;

  const topic = session.primaryTag ?? session.selectedTags[0] ?? "当下困扰";
  const text = [message, ...session.messages.map((item) => item.content)].join("\n");
  const details = [`本次主题先放在“${topic}”上`];

  if (hasAnyKeyword(text, ["不能行动", "不行动", "精力", "睡不好", "影响", "耗尽", "没有力气", "疲惫"])) {
    details.push("它已经影响到你的行动、精力或日常状态");
  }

  if (hasAnyKeyword(text, ["最近", "今天", "昨天", "上周", "3周", "三周", "一个月", "时候", "开始"])) {
    details.push("你也给出了一些时间线索");
  }

  if (hasAnyKeyword(text, ["亲密关系", "关系", "失恋", "暗恋", "喜欢的人", "伴侣", "对方", "他", "她"])) {
    details.push("这件事还和关系处境有关");
  }

  return `我先把信息收集在这里停一下。现在已经能看到几个关键点：${details.join("，")}。继续反复追问细节可能会让你更累，当前信息收集完毕，可以进入下一个步骤：一起整理这件事里的“情境-想法-情绪/身体-行为”链条。你觉得这样可行吗？`;
}

function hasOfferedIntakeTransition(session: ConsultationSession) {
  return session.messages.some((item) =>
    ["当前信息收集完毕", "信息收集在这里停一下", "进入下一个步骤"].some((marker) =>
      item.content.includes(marker)
    )
  );
}

function countUserIntakeTurns(session: ConsultationSession) {
  return session.messages.filter((item) => item.role === "user").length;
}

function countInformationSignals(session: ConsultationSession, currentMessage = "") {
  const text = [currentMessage, ...session.messages.map((item) => item.content)].join("\n");
  const signalGroups = [
    ["内耗", "焦虑", "压力", "情绪低落", "烦闷", "失落", "紧张", "窒息", "压抑"],
    ["不能行动", "不行动", "精力", "睡不好", "影响", "耗尽", "没有力气", "疲惫"],
    ["最近", "今天", "昨天", "上周", "3周", "三周", "一个月", "时候", "开始"],
    ["亲密关系", "关系", "失恋", "暗恋", "喜欢的人", "伴侣", "对方", "他", "她"],
    ["担心", "害怕", "最在意", "最难受", "压抑", "受限", "窒息"]
  ];

  return signalGroups.filter((group) => group.some((keyword) => text.includes(keyword))).length;
}

function hasAnyKeyword(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}
