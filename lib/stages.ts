import bank from "@/data/question_bank.json";
import type { Lang } from "./auth";

/**
 * Single source of truth for interview sections: data/question_bank.json.
 *
 * Two kinds of section:
 * - "common": the 10 life stages (ids 1-10), shown to everyone
 * - "field":  one per occupation/life-experience group (ids 101+), shown
 *             only to people who picked that field
 *
 * Safe to import from client components — plain JSON, no DB/Node deps.
 */
export interface Section {
  id: number;
  kind: "common" | "field";
  fieldCode: string | null;
  name: Record<Lang, string>;
  shortName: Record<Lang, string>;
  description: Record<Lang, string>;
  nameEn: string;
  questionCount: number;
}

type BankSection = (typeof bank)[number] & {
  field_code?: string;
  description_ko?: string;
  description_ja?: string;
};

export const SECTIONS: Section[] = (bank as BankSection[]).map((s) => ({
  id: s.life_stage_id,
  kind: s.kind === "field" ? "field" : "common",
  fieldCode: s.field_code ?? null,
  name: { ko: s.life_stage_ko, ja: s.life_stage_ja },
  shortName: { ko: s.life_stage_short_ko, ja: s.life_stage_short_ja },
  description: { ko: s.description_ko ?? "", ja: s.description_ja ?? "" },
  nameEn: s.life_stage_en,
  questionCount: s.questions.length,
}));

export const COMMON_STAGES = SECTIONS.filter((s) => s.kind === "common");
export const FIELD_SECTIONS = SECTIONS.filter((s) => s.kind === "field");

const byId = new Map(SECTIONS.map((s) => [s.id, s]));
const fieldCodes = new Set(FIELD_SECTIONS.map((s) => s.fieldCode));

export function isFieldStage(stageId: number): boolean {
  return byId.get(stageId)?.kind === "field";
}

export function isValidFieldCode(code: unknown): code is string {
  return typeof code === "string" && fieldCodes.has(code);
}

/** The sections a person sees, in interview order: all common stages
 * first, then the fields they picked (in question-bank order). */
export function visibleStageIds(fields: string[]): number[] {
  const picked = new Set(fields);
  return [
    ...COMMON_STAGES.map((s) => s.id),
    ...FIELD_SECTIONS.filter((s) => picked.has(s.fieldCode!)).map((s) => s.id),
  ];
}

export function stageName(lang: Lang, stageId: number): string {
  return byId.get(stageId)?.name[lang] ?? "";
}

/** Heading text: "3. 독립과 첫걸음" for life stages, just the name for fields. */
export function stageHeading(lang: Lang, stageId: number): string {
  const name = stageName(lang, stageId);
  return isFieldStage(stageId) ? name : `${stageId}. ${name}`;
}

export function stageShortName(lang: Lang, stageId: number): string {
  return byId.get(stageId)?.shortName[lang] ?? "";
}

export function stageNameEn(stageId: number): string {
  return byId.get(stageId)?.nameEn ?? "";
}

/** users.fields is stored as comma-separated codes ("B,I"). NULL means the
 * person hasn't been asked yet; "" means they chose "none of these". */
export function parseFields(stored: string | null | undefined): string[] | null {
  if (stored === null || stored === undefined) return null;
  return stored.split(",").filter(isValidFieldCode);
}

export function serializeFields(fields: string[]): string {
  return FIELD_SECTIONS.map((s) => s.fieldCode!)
    .filter((c) => fields.includes(c))
    .join(",");
}
