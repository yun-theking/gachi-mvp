import bank from "@/data/question_bank.json";
import type { Lang } from "./auth";

/**
 * Single source of truth for life-stage names: data/question_bank.json.
 * Everything that shows a stage name (question card, archive headers,
 * progress line, onboarding sample, admin Excel export) reads it from here,
 * so editing or regenerating the question bank can't leave one screen
 * showing an old name. Safe to import from client components too — it's
 * plain JSON with no DB/Node dependencies.
 */
interface StageMeta {
  id: number;
  name: Record<Lang, string>;
  shortName: Record<Lang, string>;
  nameEn: string;
}

export const STAGES: StageMeta[] = bank.map((s) => ({
  id: s.life_stage_id,
  name: { ko: s.life_stage_ko, ja: s.life_stage_ja },
  shortName: { ko: s.life_stage_short_ko, ja: s.life_stage_short_ja },
  nameEn: s.life_stage_en,
}));

export const TOTAL_STAGES = STAGES.length;

const byId = new Map(STAGES.map((s) => [s.id, s]));

export function stageName(lang: Lang, stageId: number): string {
  return byId.get(stageId)?.name[lang] ?? "";
}

export function stageShortName(lang: Lang, stageId: number): string {
  return byId.get(stageId)?.shortName[lang] ?? "";
}

export function stageNameEn(stageId: number): string {
  return byId.get(stageId)?.nameEn ?? "";
}
