import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { Header } from "@/components/layout/header";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CreatorLens — 抖音电商短视频 AI 复盘",
  description:
    "面向抖音中小商家和电商内容运营人员的 AI 商品短视频复盘工具。上传历史视频数据，获取数据证据化的内容策略洞察。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Header />
        <main className="flex-1 container mx-auto max-w-6xl px-4 py-6">
          {children}
        </main>
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
