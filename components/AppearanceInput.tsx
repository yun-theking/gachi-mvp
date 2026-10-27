"use client";

import { useState } from "react";
import { useLanguage } from "./LanguageProvider";

/** How the person looks, used to keep generated illustrations consistent. */
export default function AppearanceInput({ initial }: { initial: string }) {
  const { dict: t } = useLanguage();
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    const res = await fetch("/api/settings/appearance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appearance: value }),
    });
    setSaved(res.ok);
  };

  return (
    <div className="w-full max-w-xs flex flex-col items-center gap-2">
      <label htmlFor="appearance" className="text-sm font-semibold text-text">
        {t.appearanceTitle}
      </label>
      <p className="text-sm text-text-dim text-center">{t.appearanceHint}</p>
      <input
        id="appearance"
        value={value}
        maxLength={100}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
        placeholder={t.appearancePlaceholder}
        className="w-full rounded-2xl border-2 border-border bg-surface px-4 py-3 text-base text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
      />
      <button
        onClick={save}
        className="w-full py-3 rounded-2xl border border-border bg-surface text-base font-semibold text-accent-dark hover:bg-surface2 transition-colors"
      >
        {saved ? t.appearanceSaved : t.appearanceSave}
      </button>
    </div>
  );
}
