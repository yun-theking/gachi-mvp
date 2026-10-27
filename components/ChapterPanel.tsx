"use client";

import { useLanguage } from "./LanguageProvider";
import ChapterIllustration from "./ChapterIllustration";
import { IMAGES_ENABLED } from "@/lib/features";

interface Props {
  label?: string;
  questionKo?: string;
  transcript?: string;
  chapter: string;
  meta?: string;
  /** Lets an illustration be drawn for this answer, when images are on. */
  questionId?: number | null;
}

export default function ChapterPanel({
  label,
  questionKo,
  transcript,
  chapter,
  meta,
  questionId,
}: Props) {
  const { dict: t } = useLanguage();

  return (
    <div className="panel-enter w-full max-w-xl bg-surface border border-border rounded-2xl p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-semibold text-accent-dark">
          {label ?? t.chapterLabelDefault}
        </span>
        {meta && <span className="text-xs text-text-muted">{meta}</span>}
      </div>

      {questionKo && (
        <p className="text-sm text-accent-dark leading-relaxed">
          Q. {questionKo}
        </p>
      )}

      {transcript && (
        <p className="text-base text-text-dim leading-relaxed border-l-2 border-border pl-3">
          {transcript}
        </p>
      )}

      <p className="font-serif text-text text-lg leading-8 whitespace-pre-wrap">
        {chapter}
      </p>
      {IMAGES_ENABLED && questionId ? <ChapterIllustration questionId={questionId} /> : null}
    </div>
  );
}
