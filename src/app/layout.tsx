import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "JP Bridge — 일본 취업 AI 코파일럿",
    template: "%s | JP Bridge",
  },
  description:
    "일본 新卒·第二新卒·IT 경력 취업을 준비하는 한국 청년을 위한 AI 코칭: ES 첨삭, 모의면접, 자기분석, 경력 번역, 일정·비자 체크리스트.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcfcfd" },
    { media: "(prefers-color-scheme: dark)", color: "#16181d" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
