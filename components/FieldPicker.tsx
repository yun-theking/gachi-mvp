"use client";

import { useState } from "react";
import { useLanguage } from "./LanguageProvider";
import { IconCheck } from "./icons";
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
  const [selected, setSelected] = useState<string[]>(initialFields);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const toggle = (code: string) =>
    setSelected((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/settings/fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: selected }),
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
      </div>

      <div className="w-full max-w-xl flex flex-col gap-3">
        {FIELD_SECTIONS.map((f) => {
          const on = selected.includes(f.fieldCode!);
          return (
            <button
              key={f.fieldCode}
              onClick={() => toggle(f.fieldCode!)}
              aria-pressed={on}
              className={`w-full text-left rounded-2xl border-2 px-4 py-4 flex items-center gap-3 transition-colors ${
                on ? "border-accent bg-accent/10" : "border-border bg-surface hover:bg-surface2"
              }`}
            >
              <span
                className={`shrink-0 w-7 h-7 rounded-lg border-2 flex items-center justify-center ${
                  on ? "bg-accent border-accent text-bg" : "border-border bg-bg"
                }`}
              >
                {on && <IconCheck className="w-5 h-5" />}
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
            {selected.length > 0 ? t.fieldsDone(selected.length) : t.fieldsNone}
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
