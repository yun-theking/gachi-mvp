"use client";

import { useLanguage } from "./LanguageProvider";
import { STAGE_NAMES_SHORT } from "@/lib/i18n";

interface Props {
  currentStageId: number | null; // null = all done
  stagePosition: { position: number; total: number } | null;
}

export default function StageProgress({ currentStageId, stagePosition }: Props) {
  const { lang, dict: t } = useLanguage();

  if (currentStageId === null || !stagePosition) {
    return (
      <div className="w-full flex flex-col gap-2">
        <p className="text-xs text-text-dim">{t.allStagesDone}</p>
      </div>
    );
  }

  const { position, total } = stagePosition;
  const pct = total > 0 ? Math.round((position / total) * 100) : 0;

  return (
    <div className="w-full flex flex-col gap-2">
      <p className="text-xs text-text-dim">
        {t.questionCountLabel(position, total, STAGE_NAMES_SHORT[lang][currentStageId])}
      </p>
      <div className="w-full h-1.5 rounded-full bg-surface2 overflow-hidden">
        <div
          className="h-full rounded-full bg-accent transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
