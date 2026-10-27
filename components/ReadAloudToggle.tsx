"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "./LanguageProvider";
import { readAloudEnabled, setReadAloudEnabled, speak, speechSupported } from "@/hooks/useSpeech";

export default function ReadAloudToggle() {
  const { lang, dict: t } = useLanguage();
  const [on, setOn] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    setOn(readAloudEnabled());
    setSupported(speechSupported());
  }, []);

  if (!supported) return null;

  const choose = (next: boolean) => {
    setOn(next);
    setReadAloudEnabled(next);
    if (next) speak(t.readAloudSample, lang);
  };

  return (
    <div className="w-full max-w-xs flex flex-col items-center gap-2">
      <p className="text-sm font-semibold text-text">{t.readAloudTitle}</p>
      <p className="text-sm text-text-dim text-center">{t.readAloudHint}</p>
      <div className="w-full grid grid-cols-2 gap-2 mt-1">
        {[true, false].map((value) => (
          <button
            key={String(value)}
            onClick={() => choose(value)}
            aria-pressed={on === value}
            className={`py-3 rounded-2xl border font-semibold text-base transition-colors ${
              on === value
                ? "bg-accent text-bg border-accent"
                : "bg-surface text-text-dim border-border hover:bg-surface2"
            }`}
          >
            {value ? t.readAloudOn : t.readAloudOff}
          </button>
        ))}
      </div>
    </div>
  );
}
