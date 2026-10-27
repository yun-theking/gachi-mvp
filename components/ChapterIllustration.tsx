"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "./LanguageProvider";

/** "그림으로 보기" for one answer (only when images are switched on). Shows a
 * saved illustration if there is one; otherwise draws one on tap. */
export default function ChapterIllustration({ questionId }: { questionId: number }) {
  const { dict: t } = useLanguage();
  const [image, setImage] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "drawing" | "failed">("idle");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/illustrate?questionId=${questionId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.image) setImage(d.image);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [questionId]);

  const draw = async () => {
    setState("drawing");
    try {
      const res = await fetch("/api/illustrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId }),
      });
      const d = await res.json();
      if (!res.ok || !d.image) throw new Error();
      setImage(d.image);
      setState("idle");
    } catch {
      setState("failed");
    }
  };

  if (image) {
    // eslint-disable-next-line @next/next/no-img-element -- data: URL, nothing for next/image to optimise
    return <img src={image} alt={t.illustrationAlt} className="w-full rounded-xl border border-border" />;
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={draw}
        disabled={state === "drawing"}
        className="self-start min-h-[44px] px-4 rounded-xl border border-border bg-surface2 text-base font-semibold text-accent-dark disabled:opacity-70"
      >
        {state === "drawing" ? t.illustrating : t.illustrate}
      </button>
      {state === "failed" && <p className="text-sm text-danger">{t.illustrateFailed}</p>}
    </div>
  );
}
