"use client";

import { useState } from "react";
import { useLanguage } from "./LanguageProvider";

/** Opt-in to using answers for service improvement (only shown when the
 * feature is switched on — see lib/features.ts). */
export default function ConsentToggle({ initial }: { initial: boolean }) {
  const { dict: t } = useLanguage();
  const [consent, setConsent] = useState(initial);
  const [saving, setSaving] = useState(false);

  const choose = async (next: boolean) => {
    if (next === consent || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consent: next }),
      });
      if (res.ok) setConsent(next);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-xs flex flex-col items-center gap-2">
      <p className="text-sm font-semibold text-text">{t.consentTitle}</p>
      <p className="text-sm text-text-dim leading-relaxed">{t.consentBody}</p>
      <div className="w-full grid grid-cols-2 gap-2 mt-1">
        {[true, false].map((value) => (
          <button
            key={String(value)}
            onClick={() => choose(value)}
            disabled={saving}
            aria-pressed={consent === value}
            className={`py-3 rounded-2xl border font-semibold text-base transition-colors ${
              consent === value
                ? "bg-accent text-white border-accent"
                : "bg-surface text-text-dim border-border hover:bg-surface2"
            }`}
          >
            {value ? t.consentYes : t.consentNo}
          </button>
        ))}
      </div>
    </div>
  );
}
