import type { Metadata } from "next";
import { cookies } from "next/headers";
import AppChrome from "@/components/AppChrome";
import { LanguageProvider } from "@/components/LanguageProvider";
import { QuestionSelectionProvider } from "@/components/QuestionSelectionProvider";
import { USER_COOKIE, LANG_COOKIE, DEFAULT_LANG, isValidLang, FONT_SCALE_COOKIE, DEFAULT_FONT_SCALE, isValidFontScale } from "@/lib/auth";
// Fonts are bundled with the app (npm packages, served from our own domain),
// so nobody has to install a Japanese font and nothing depends on reaching
// Google's CDN. They're split by unicode-range: the browser downloads only
// the pieces a page actually uses. Font order per language: globals.css.
import "@fontsource-variable/noto-sans-kr";
import "@fontsource-variable/noto-sans-jp";
import "@fontsource-variable/noto-serif-kr";
import "@fontsource-variable/noto-serif-jp";
import "./globals.css";

// Browser-tab title and description follow the selected language.
const METADATA: Record<"ko" | "ja", Metadata> = {
  ko: { title: "가치 (Gachi) — 나만의 회고록", description: "목소리로 답하며 완성하는 나만의 회고록" },
  ja: { title: "Gachi — わたしの回顧録", description: "声で答えて完成させる、自分だけの回顧録" },
};

export async function generateMetadata(): Promise<Metadata> {
  const langCookie = (await cookies()).get(LANG_COOKIE)?.value;
  return METADATA[isValidLang(langCookie) ? langCookie : DEFAULT_LANG];
}

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
