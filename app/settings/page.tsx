import { cookies } from "next/headers";
import { LANG_COOKIE, DEFAULT_LANG, isValidLang } from "@/lib/auth";
import { getDict } from "@/lib/i18n";

export default async function SettingsPage() {
  const store = await cookies();
  const langCookie = store.get(LANG_COOKIE)?.value;
  const lang = isValidLang(langCookie) ? langCookie : DEFAULT_LANG;
  const t = getDict(lang);

  return (
    <main className="min-h-[70vh] flex flex-col items-center justify-center gap-2 px-4">
      <h1 className="font-serif text-xl font-bold text-text mb-1">{t.settingsTitle}</h1>
      <p className="text-sm text-text-dim">{t.settingsBody}</p>
    </main>
  );
}
