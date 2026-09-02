"use client";

import type { Summary } from "./types";

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  let current = "";

  for (const char of text) {
    const next = current + char;
    if (ctx.measureText(next).width > maxWidth && current) {
      lines.push(current);
      current = char;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines;
}

export function exportSummaryImage(summary: Summary) {
  const canvas = document.createElement("canvas");
  const width = 900;
  const padding = 58;
  const sectionGap = 26;
  const lineHeight = 30;
  const maxWidth = width - padding * 2;
  const ctx = canvas.getContext("2d");

  if (!ctx) return;

  ctx.font = "26px sans-serif";

  const sections = [
    ["本次主要困扰", summary.mainConcern],
    ["关键情境", summary.keySituation],
    ["主要情绪", summary.mainEmotions],
    ["当时的想法", summary.thoughts],
    ["可继续探索的方向", summary.explorationDirection],
    ["关键对话片段", summary.keyQuotes.map((quote) => `“${quote}”`).join("\n")]
  ];

  const measured = sections.map(([title, body]) => {
    ctx.font = "28px sans-serif";
    const titleLines = wrapText(ctx, title, maxWidth);
    ctx.font = "24px sans-serif";
    const bodyLines = body
      .split("\n")
      .flatMap((line) => wrapText(ctx, line.trim(), maxWidth));
    return { title, body, titleLines, bodyLines };
  });

  const height =
    padding * 2 +
    72 +
    measured.reduce(
      (sum, item) => sum + item.titleLines.length * 34 + item.bodyLines.length * lineHeight + sectionGap,
      0
    ) +
    74;

  canvas.width = width;
  canvas.height = height;

  ctx.fillStyle = "#fffaf1";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#2c2925";
  ctx.font = "bold 34px sans-serif";
  ctx.fillText("咨询回顾", padding, padding);

  ctx.fillStyle = "#756f66";
  ctx.font = "22px sans-serif";
  ctx.fillText(new Date(summary.createdAt).toLocaleString("zh-CN"), padding, padding + 42);

  let y = padding + 94;
  for (const item of measured) {
    ctx.strokeStyle = "#e5dbce";
    ctx.beginPath();
    ctx.moveTo(padding, y - 16);
    ctx.lineTo(width - padding, y - 16);
    ctx.stroke();

    ctx.fillStyle = "#45645a";
    ctx.font = "bold 28px sans-serif";
    for (const line of item.titleLines) {
      ctx.fillText(line, padding, y);
      y += 34;
    }

    ctx.fillStyle = "#4c463f";
    ctx.font = "24px sans-serif";
    for (const line of item.bodyLines) {
      ctx.fillText(line, padding, y);
      y += lineHeight;
    }
    y += sectionGap;
  }

  ctx.strokeStyle = "#e5dbce";
  ctx.beginPath();
  ctx.moveTo(padding, y - 10);
  ctx.lineTo(width - padding, y - 10);
  ctx.stroke();
  ctx.fillStyle = "#756f66";
  ctx.font = "20px sans-serif";
  const disclaimer = "本内容由 AI 生成，仅供自我回顾，不替代专业心理咨询、心理治疗、精神科诊断或医疗服务。";
  for (const line of wrapText(ctx, disclaimer, maxWidth)) {
    ctx.fillText(line, padding, y + 20);
    y += 26;
  }

  const link = document.createElement("a");
  link.download = `心屿咨询回顾-${summary.id}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}
