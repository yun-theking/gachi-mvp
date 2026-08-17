"use client";

import { useLanguage } from "./LanguageProvider";

export interface BankQuestion {
  id: number;
  life_stage_id: number;
  life_stage_ko: string;
  life_stage_ja: string;
  question_ko: string;
  question_ja: string;
}

interface Props {
  question: BankQuestion | null;
}

export default function QuestionCard({ question }: Props) {
  const { lang, dict: t } = useLanguage();

  if (!question) {
    return (
      <div className="w-full max-w-xl bg-surface border border-border rounded-2xl p-8 text-center">
        <p className="font-serif text-accent-dark font-semibold text-lg mb-2">
          {t.allDoneTitle}
        </p>
        <p className="text-text-dim text-sm">{t.allDoneBody}</p>
      </div>
    );
  }

  const stageLabel = lang === "ja" ? question.life_stage_ja : question.life_stage_ko;
  const questionText = lang === "ja" ? question.question_ja : question.question_ko;

  return (
    <div className="w-full max-w-xl bg-surface border border-border rounded-2xl p-6 flex flex-col gap-3">
      <span className="text-xs font-semibold text-accent-dark">{stageLabel}</span>
      <p className="font-bold text-text text-xl leading-relaxed">{questionText}</p>
    </div>
  );
}
