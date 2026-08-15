import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "가치 (Gachi) — 나만의 회고록",
  description: "닛케이「私の履歴書」106개 질문으로 완성하는 나의 이야기",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@300;400;600;700&family=Noto+Sans+KR:wght@300;400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased bg-bg text-text font-sans min-h-screen">
        <nav className="w-full max-w-xl mx-auto flex items-center justify-center gap-8 pt-8 text-xs tracking-widest uppercase text-text-muted">
          <Link href="/" className="hover:text-gold transition-colors">
            인터뷰
          </Link>
          <Link href="/archive" className="hover:text-gold transition-colors">
            내 회고록
          </Link>
        </nav>
        {children}
      </body>
    </html>
  );
}
