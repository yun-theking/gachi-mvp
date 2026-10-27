"use client";

import { useState } from "react";
import { useLanguage } from "./LanguageProvider";
import { FIELD_SECTIONS } from "@/lib/stages";

export default function FieldPicker({
  initialFields,
  next,
  firstTime,
}: {
  initialFields: string[];
  next: string;
  firstTime: boolean;
}) {
  const { lang, dict: t } = useLanguage();
  // One field only. Accounts saved while multiple picks were allowed start
  // with their first pick selected.
  const [selected, setSelected] = useState<string | null>(initialFields[0] ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Tapping the selected one again clears it ("none of these").
  const choose = (code: string) => setSelected((prev) => (prev === code ? null : code));

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/settings/fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: selected ? [selected] : [] }),
      });
      if (!res.ok) throw new Error();
      window.location.href = next;
    } catch {
      setError(t.networkErrorMessage);
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center px-4 pt-10 pb-36">
      <div className="w-full max-w-xl flex flex-col gap-2 mb-6">
        <h1 className="font-serif text-2xl font-bold text-text">{t.fieldsTitle}</h1>
        <p className="text-base text-text-dim leading-relaxed">{t.fieldsSubtitle}</p>
        <p className="self-start mt-1 text-sm font-bold text-accent-dark bg-accent/10 border border-accent/30 rounded-full px-3 py-1">
          {t.fieldsSingleHint}
        </p>
      </div>

      <div role="radiogroup" aria-label={t.fieldsTitle} className="w-full max-w-xl flex flex-col gap-3">
        {FIELD_SECTIONS.map((f) => {
          const on = selected === f.fieldCode;
          return (
            <button
              key={f.fieldCode}
              onClick={() => choose(f.fieldCode!)}
              role="radio"
              aria-checked={on}
              className={`w-full text-left rounded-2xl border-2 px-4 py-4 flex items-center gap-3 transition-colors ${
                on ? "border-accent bg-accent/10" : "border-border bg-surface hover:bg-surface2"
              }`}
            >
              <span
                className={`shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center ${
                  on ? "border-accent" : "border-border bg-bg"
                }`}
              >
                {on && <span className="w-3.5 h-3.5 rounded-full bg-accent" />}
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-lg font-semibold text-text">{f.name[lang]}</span>
                {f.description[lang] && (
                  <span className="text-sm text-text-dim">{f.description[lang]}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div className="fixed bottom-0 inset-x-0 bg-bg/95 backdrop-blur border-t border-border px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="max-w-xl mx-auto flex flex-col gap-2">
          {error && <p className="text-base text-danger text-center">{error}</p>}
          <button
            onClick={save}
            disabled={saving}
            className="w-full py-4 rounded-2xl bg-accent text-bg font-semibold text-lg tracking-wide disabled:opacity-60"
          >
            {selected ? t.fieldsDone : t.fieldsNone}
          </button>
          {!firstTime && (
            <button
              onClick={() => (window.location.href = next)}
              className="text-base text-text-dim underline py-2"
            >
              {t.fieldsCancel}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
