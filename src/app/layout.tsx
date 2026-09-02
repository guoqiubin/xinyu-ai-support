import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "心屿 · AI 情绪支持助手",
  description: "当你感到焦虑、压力或内耗时，可以在这里慢慢说清楚。"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
