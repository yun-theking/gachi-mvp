import { describe, it, expect } from "vitest";
import bank from "@/data/question_bank.json";
import { STAGES, TOTAL_STAGES, stageName, stageShortName, stageNameEn } from "@/lib/stages";

describe("life stages (single source: question_bank.json)", () => {
  it("stage ids run 1..N with no gaps", () => {
    expect(STAGES.map((s) => s.id)).toEqual(
      Array.from({ length: TOTAL_STAGES }, (_, i) => i + 1)
    );
  });

  it("every stage has all names filled in, in every language", () => {
    for (const s of STAGES) {
      expect(stageName("ko", s.id)).not.toBe("");
      expect(stageName("ja", s.id)).not.toBe("");
      expect(stageShortName("ko", s.id)).not.toBe("");
      expect(stageShortName("ja", s.id)).not.toBe("");
      expect(stageNameEn(s.id)).not.toBe("");
    }
  });

  it("every stage has at least one question with both languages filled in", () => {
    for (const stage of bank) {
      expect(stage.questions.length).toBeGreaterThan(0);
      for (const q of stage.questions) {
        expect(q.question_ko.trim()).not.toBe("");
        expect(q.question_ja.trim()).not.toBe("");
      }
    }
  });

  it("unknown stage ids return an empty name instead of crashing", () => {
    expect(stageName("ko", 999)).toBe("");
  });
});
