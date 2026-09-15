import { cookies } from "next/headers";
import { LANG_COOKIE, DEFAULT_LANG, isValidLang, FONT_SCALE_COOKIE, DEFAULT_FONT_SCALE, isValidFontScale } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import FontScaleToggle from "@/components/FontScaleToggle";

export default async function SettingsPage() {
  const store = await cookies();
  const langCookie = store.get(LANG_COOKIE)?.value;
  const lang = isValidLang(langCookie) ? langCookie : DEFAULT_LANG;
  const t = getDict(lang);
  const fontScaleCookie = store.get(FONT_SCALE_COOKIE)?.value;
  const fontScale = isValidFontScale(fontScaleCookie) ? fontScaleCookie : DEFAULT_FONT_SCALE;

  return (
    <main className="min-h-[70vh] flex flex-col items-center justify-center gap-8 px-4">
      <div className="flex flex-col items-center gap-2">
        <h1 className="font-serif text-xl font-bold text-text mb-1">{t.settingsTitle}</h1>
        <p className="text-base text-text-dim">{t.settingsBody}</p>
      </div>
      <FontScaleToggle initialScale={fontScale} />
    </main>
  );
}
