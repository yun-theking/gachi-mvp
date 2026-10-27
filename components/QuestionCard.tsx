"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "./LanguageProvider";
import { IconSpeaker } from "./icons";
import { speak, speechSupported } from "@/hooks/useSpeech";

export interface BankQuestion {
  id: number;
  life_stage_id: number;
  life_stage_ko: string;
  life_stage_ja: string;
  question_ko: string;
  question_ja: string;
  /** Position in this person's question list (1, 2, 3…), if known. */
  number?: number | null;
}

interface Props {
  question: BankQuestion | null;
}

export default function QuestionCard({ question }: Props) {
  const { lang, dict: t } = useLanguage();
  // Checked after mount: the server render can't know if the browser can speak.
  const [canSpeak, setCanSpeak] = useState(false);
  useEffect(() => setCanSpeak(speechSupported()), []);

  if (!question) {
    return (
      <div className="w-full max-w-xl bg-surface border border-border rounded-2xl p-8 text-center">
        <p className="font-serif text-accent-dark font-semibold text-lg mb-2">
          {t.allDoneTitle}
        </p>
        <p className="text-text-dim text-base">{t.allDoneBody}</p>
      </div>
    );
  }

  const stageLabel = lang === "ja" ? question.life_stage_ja : question.life_stage_ko;
  const questionText = lang === "ja" ? question.question_ja : question.question_ko;

  return (
    <div className="w-full max-w-xl bg-surface border border-border rounded-2xl px-6 pt-5 pb-7 flex flex-col gap-4 shadow-[0_1px_0_#E2DDD3,0_10px_24px_-18px_rgba(31,28,24,0.35)]">
      <div className="flex items-center gap-2 flex-wrap">
        {canSpeak && (
          <button
            type="button"
            onClick={() => speak(questionText, lang)}
            aria-label={t.listen}
            className="order-last ml-auto flex items-center gap-1 min-h-[40px] px-3 rounded-xl border border-border bg-bg text-sm font-semibold text-accent-dark"
          >
            <IconSpeaker className="w-5 h-5" />
            {t.listen}
          </button>
        )}
        {question.number != null && (
          <span className="text-sm font-bold text-white bg-text rounded-full px-3 py-0.5 tabular-nums">
            {t.questionNumberLabel(question.number)}
          </span>
        )}
        <span className="text-sm font-semibold text-accent-dark">{stageLabel}</span>
      </div>
      <p className="font-serif font-semibold text-text text-[1.6rem] leading-[1.55] tracking-[-0.01em]">
        {questionText}
      </p>
    </div>
  );
}
