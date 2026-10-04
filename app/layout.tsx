import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "音记 · Yinji | Hear it. Say it. Keep it.",
  description: "从音标到连读，循序渐进学习美式英语。Learn American English, one sound at a time.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
