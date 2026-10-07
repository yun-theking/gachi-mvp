import { describe, it, expect } from "vitest";
import bank from "@/data/question_bank.json";
import {
  SECTIONS,
  COMMON_STAGES,
  FIELD_SECTIONS,
  stageName,
  stageShortName,
  stageNameEn,
  stageHeading,
  visibleStageIds,
  parseFields,
  serializeFields,
} from "@/lib/stages";

describe("question bank (single source: question_bank.json)", () => {
  it("has 10 common life stages numbered 1..10", () => {
    expect(COMMON_STAGES.map((s) => s.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("has 11 field groups A..K with ids 101+", () => {
    expect(FIELD_SECTIONS.map((s) => s.fieldCode)).toEqual(
      ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"]
    );
    expect(FIELD_SECTIONS.every((s) => s.id > 100)).toBe(true);
  });

  it("has 50 common + 88 field questions, every id unique", () => {
    const common = COMMON_STAGES.reduce((n, s) => n + s.questionCount, 0);
    const field = FIELD_SECTIONS.reduce((n, s) => n + s.questionCount, 0);
    expect([common, field]).toEqual([50, 88]);
    const ids = bank.flatMap((s) => s.questions.map((q) => q.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every section has all names filled in, in every language", () => {
    for (const s of SECTIONS) {
      for (const lang of ["ko", "ja"] as const) {
        expect(stageName(lang, s.id)).not.toBe("");
        expect(stageShortName(lang, s.id)).not.toBe("");
      }
      expect(stageNameEn(s.id)).not.toBe("");
    }
  });

  it("every question has both languages filled in", () => {
    for (const stage of bank) {
      for (const q of stage.questions) {
        expect(q.question_ko.trim()).not.toBe("");
        expect(q.question_ja.trim()).not.toBe("");
      }
    }
  });

  it("headings number life stages but not field groups", () => {
    expect(stageHeading("ko", 1)).toMatch(/^1\. /);
    expect(stageHeading("ko", 102)).not.toMatch(/^\d/);
  });
});

describe("fields", () => {
  it("visible sections: common stages first, then picked fields in bank order", () => {
    expect(visibleStageIds([])).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(visibleStageIds(["I", "B"])).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 102, 109]);
  });

  it("stored value: NULL = not asked yet, '' = none chosen, unknown codes dropped", () => {
    expect(parseFields(null)).toBeNull();
    expect(parseFields("")).toEqual([]);
    expect(parseFields("B,Z,I")).toEqual(["B", "I"]);
    expect(serializeFields(["I", "B"])).toBe("B,I");
  });
});
