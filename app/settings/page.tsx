import { cookies } from "next/headers";
import { LANG_COOKIE, DEFAULT_LANG, isValidLang, FONT_SCALE_COOKIE, DEFAULT_FONT_SCALE, isValidFontScale } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import FontScaleToggle from "@/components/FontScaleToggle";
import { USER_COOKIE } from "@/lib/auth";
import { getUserFields } from "@/lib/questions";
import { FIELD_SECTIONS } from "@/lib/stages";

export default async function SettingsPage() {
  const store = await cookies();
  const langCookie = store.get(LANG_COOKIE)?.value;
  const lang = isValidLang(langCookie) ? langCookie : DEFAULT_LANG;
  const t = getDict(lang);
  const fontScaleCookie = store.get(FONT_SCALE_COOKIE)?.value;
  const fontScale = isValidFontScale(fontScaleCookie) ? fontScaleCookie : DEFAULT_FONT_SCALE;
  const userId = store.get(USER_COOKIE)?.value;
  const fields = (userId ? await getUserFields(userId) : null) ?? [];
  const fieldNames = FIELD_SECTIONS.filter((f) => fields.includes(f.fieldCode!)).map(
    (f) => f.shortName[lang]
  );

  return (
    <main className="min-h-[70vh] flex flex-col items-center justify-center gap-8 px-4">
      <div className="flex flex-col items-center gap-2">
        <h1 className="font-serif text-xl font-bold text-text mb-1">{t.settingsTitle}</h1>
        <p className="text-base text-text-dim">{t.settingsBody}</p>
      </div>
      <FontScaleToggle initialScale={fontScale} />
      <div className="w-full max-w-xs flex flex-col items-center gap-2">
        <p className="text-sm font-semibold text-text">{t.settingsFieldsLabel}</p>
        <p className="text-base text-text-dim text-center">
          {fieldNames.length > 0 ? fieldNames.join(", ") : t.settingsFieldsNone}
        </p>
        <a
          href="/fields?next=/settings"
          className="w-full mt-1 py-3 rounded-2xl border border-border bg-surface text-center text-base font-semibold text-accent-dark hover:bg-surface2 transition-colors"
        >
          {t.settingsFieldsChange}
        </a>
      </div>
    </main>
  );
}
