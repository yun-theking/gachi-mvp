"use client";

import { useRef } from "react";
import { useLanguage } from "./LanguageProvider";
import type { TranscriptReview } from "@/lib/interviewApi";

/**
 * Shown after speech-to-text, before a chapter is written: the person sees
 * what was heard, can fix it, and confirms. Words the AI already corrected
 * and words it wasn't sure about are listed so they're easy to check.
 */
export default function TranscriptReviewPanel({
  review,
  text,
  onChange,
  onConfirm,
  onRerecord,
}: {
  review: TranscriptReview;
  text: string;
  onChange: (text: string) => void;
  onConfirm: () => void;
  onRerecord: () => void;
}) {
  const { dict: t } = useLanguage();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Tapping a doubtful word selects it in the text so it can be retyped.
  const focusWord = (word: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const at = el.value.indexOf(word);
    el.focus();
    if (at >= 0) el.setSelectionRange(at, at + word.length);
  };

  return (
    <div className="panel-enter w-full max-w-xl flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-serif text-xl font-bold text-text">{t.reviewTitle}</h2>
        <p className="text-base text-text-dim leading-relaxed">{t.reviewHint}</p>
      </div>

      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => onChange(e.target.value)}
        rows={Math.min(12, Math.max(4, Math.ceil(text.length / 28)))}
        className="w-full rounded-2xl border-2 border-border bg-surface px-4 py-3 text-lg leading-relaxed text-text focus:outline-none focus:border-accent"
      />

      {review.uncertain.length > 0 && (
        <div className="flex flex-col gap-2 rounded-2xl border border-danger/40 bg-danger/5 p-4">
          <p className="text-base font-semibold text-danger">{t.reviewUncertainLabel}</p>
          <p className="text-sm text-text-dim">{t.reviewUncertainHint}</p>
          <div className="flex flex-wrap gap-2">
            {review.uncertain.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => focusWord(w)}
                className="min-h-[44px] px-4 rounded-xl border border-danger/40 bg-bg text-base font-semibold text-text"
              >
                {w}
              </button>
            ))}
          </div>
        </div>
      )}

      {review.corrections.length > 0 && (
        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface2/60 p-4">
          <p className="text-base font-semibold text-accent-dark">{t.reviewCorrectedLabel}</p>
          <ul className="flex flex-col gap-1">
            {review.corrections.map((c) => (
              <li key={`${c.from}→${c.to}`} className="text-base text-text">
                <span className="line-through text-text-dim">{c.from}</span>
                {" → "}
                <span className="font-semibold">{c.to}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        onClick={onConfirm}
        disabled={text.trim().length < 2}
        className="w-full py-4 rounded-2xl bg-accent text-bg font-semibold text-lg tracking-wide disabled:opacity-60"
      >
        {t.reviewConfirm}
      </button>
      <button
        onClick={onRerecord}
        className="text-base text-text-dim underline py-2 hover:text-accent-dark transition-colors"
      >
        {t.reviewRerecord}
      </button>
    </div>
  );
}
