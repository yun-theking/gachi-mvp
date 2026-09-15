"use client";

import { useState } from "react";
import { useLanguage } from "./LanguageProvider";
import type { FontScale } from "@/lib/auth";

const OPTIONS: FontScale[] = ["sm", "md", "lg"];

export default function FontScaleToggle({ initialScale }: { initialScale: FontScale }) {
  const { dict: t } = useLanguage();
  const [scale, setScale] = useState<FontScale>(initialScale);

  const labelFor = (s: FontScale) =>
    s === "sm" ? t.fontScaleSmall : s === "md" ? t.fontScaleMedium : t.fontScaleLarge;

  const choose = async (next: FontScale) => {
    if (next === scale) return;
    setScale(next);
    // Apply immediately so it doesn't wait on the network round trip.
    document.documentElement.setAttribute("data-font-scale", next);
    try {
      await fetch("/api/settings/font-scale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fontScale: next }),
      });
    } catch {
      // Best-effort: the in-memory attribute is already applied for this
      // visit; if the save failed it'll just fall back to the old size on
      // the next full page load, which isn't disruptive enough to alert on.
    }
  };

  return (
    <div className="w-full max-w-xs flex flex-col items-center gap-2">
      <p className="text-sm font-semibold text-text">{t.fontScaleTitle}</p>
      <p className="text-sm text-text-dim text-center">{t.fontScaleHint}</p>
      <div className="w-full grid grid-cols-3 gap-2 mt-1">
        {OPTIONS.map((opt) => (
          <button
            key={opt}
            onClick={() => choose(opt)}
            aria-pressed={scale === opt}
            className={`py-3 rounded-2xl border font-semibold transition-colors ${
              scale === opt
                ? "bg-accent text-bg border-accent"
                : "bg-surface text-text-dim border-border hover:bg-surface2"
            } ${opt === "sm" ? "text-base" : opt === "md" ? "text-lg" : "text-xl"}`}
          >
            {labelFor(opt)}
          </button>
        ))}
      </div>
    </div>
  );
}
