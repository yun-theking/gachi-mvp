"use client";

import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "./LanguageProvider";
import { useQuestionSelection } from "./QuestionSelectionProvider";
import { IconClose, IconCheck } from "./icons";

interface QuestionApiRow {
  id: number;
  life_stage_id: number;
  life_stage_ko: string;
  life_stage_ja: string;
  question_ko: string;
  question_ja: string;
  answered: boolean;
}

export default function QuestionListModal() {
  const { lang, dict: t } = useLanguage();
  const { isListOpen, closeList, selectQuestion } = useQuestionSelection();

  const [questions, setQuestions] = useState<QuestionApiRow[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!isListOpen) return;

    let cancelled = false;
    setLoadError(false);

    fetch("/api/all-questions")
      .then((res) => {
        if (!res.ok) throw new Error("failed");
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setQuestions(data.questions as QuestionApiRow[]);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [isListOpen]);

  const stages = useMemo(() => {
    if (!questions) return [];
    const byStage = new Map<number, QuestionApiRow[]>();
    for (const q of questions) {
      const list = byStage.get(q.life_stage_id);
      if (list) list.push(q);
      else byStage.set(q.life_stage_id, [q]);
    }
    return Array.from(byStage.entries())
      .sort(([a], [b]) => a - b)
      .map(([stageId, list]) => ({ stageId, list }));
  }, [questions]);

  const { answeredCount, totalCount } = useMemo(() => {
    if (!questions) return { answeredCount: 0, totalCount: 0 };
    return {
      answeredCount: questions.filter((q) => q.answered).length,
      totalCount: questions.length,
    };
  }, [questions]);

  if (!isListOpen) return null;

  const handlePick = (stageList: QuestionApiRow[], q: QuestionApiRow) => {
    if (q.answered) return;
    const position = stageList.findIndex((x) => x.id === q.id) + 1;
    selectQuestion({
      id: q.id,
      life_stage_id: q.life_stage_id,
      life_stage_ko: q.life_stage_ko,
      life_stage_ja: q.life_stage_ja,
      question_ko: q.question_ko,
      question_ja: q.question_ja,
      stagePosition: { position, total: stageList.length },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg">
      <div className="sticky top-0 bg-bg/95 backdrop-blur border-b border-border">
        <div className="max-w-xl mx-auto px-4 py-4 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg font-bold text-text">{t.questionListTitle}</h2>
            <button
              onClick={closeList}
              aria-label={t.questionListClose}
              className="w-9 h-9 flex items-center justify-center rounded-full text-text-dim hover:bg-surface2 transition-colors"
            >
              <IconClose className="w-5 h-5" />
            </button>
          </div>
          <p className="text-xs text-text-dim">{t.questionListSubtitle}</p>
          {questions && (
            <p className="text-xs text-accent-dark font-semibold mt-1">
              {t.questionListProgress(answeredCount, totalCount)}
            </p>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-xl mx-auto px-4 py-4 flex flex-col gap-6">
          {loadError && <p className="text-sm text-danger">{t.networkErrorMessage}</p>}

          {!questions && !loadError && (
            <div className="flex flex-col gap-3 animate-pulse">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-14 w-full bg-surface2 rounded-2xl" />
              ))}
            </div>
          )}

          {stages.map(({ stageId, list }) => {
            const stageLabel = lang === "ja" ? list[0].life_stage_ja : list[0].life_stage_ko;
            return (
              <div key={stageId} className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold text-accent-dark px-1">
                  {stageId}. {stageLabel}
                </h3>
                <div className="flex flex-col gap-2">
                  {list.map((q) => {
                    const questionText = lang === "ja" ? q.question_ja : q.question_ko;
                    return (
                      <button
                        key={q.id}
                        onClick={() => handlePick(list, q)}
                        disabled={q.answered}
                        className={`text-left w-full rounded-2xl border px-4 py-3 flex items-start gap-3 transition-colors ${
                          q.answered
                            ? "border-border bg-surface2/60 text-text-dim cursor-default"
                            : "border-border bg-surface text-text hover:border-accent hover:bg-surface2"
                        }`}
                      >
                        <span className="flex-1 text-sm leading-relaxed">{questionText}</span>
                        {q.answered && (
                          <span className="shrink-0 flex items-center gap-1 text-[11px] font-semibold text-accent-dark bg-accent/10 rounded-full px-2 py-1">
                            <IconCheck className="w-3 h-3" />
                            {t.questionListAnsweredBadge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
