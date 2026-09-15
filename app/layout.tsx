import type { Metadata } from "next";
import { cookies } from "next/headers";
import AppChrome from "@/components/AppChrome";
import { LanguageProvider } from "@/components/LanguageProvider";
import { QuestionSelectionProvider } from "@/components/QuestionSelectionProvider";
import { USER_COOKIE, LANG_COOKIE, DEFAULT_LANG, isValidLang, FONT_SCALE_COOKIE, DEFAULT_FONT_SCALE, isValidFontScale } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "가치 (Gachi) — 나만의 회고록",
  description: "닛케이「私の履歴書」106개 질문으로 완성하는 나의 이야기",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const store = await cookies();
  const userId = store.get(USER_COOKIE)?.value ?? null;
  const langCookie = store.get(LANG_COOKIE)?.value;
  const lang = isValidLang(langCookie) ? langCookie : DEFAULT_LANG;
  const fontScaleCookie = store.get(FONT_SCALE_COOKIE)?.value;
  const fontScale = isValidFontScale(fontScaleCookie) ? fontScaleCookie : DEFAULT_FONT_SCALE;

  return (
    <html lang={lang} data-font-scale={fontScale}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@300;400;600;700&family=Noto+Sans+KR:wght@300;400;500&family=Noto+Serif+JP:wght@300;400;600;700&family=Noto+Sans+JP:wght@300;400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased bg-bg text-text font-sans min-h-screen">
        <LanguageProvider lang={lang}>
          <QuestionSelectionProvider>
            <AppChrome userId={userId}>{children}</AppChrome>
          </QuestionSelectionProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
