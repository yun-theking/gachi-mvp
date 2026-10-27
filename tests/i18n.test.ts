import { describe, it, expect } from "vitest";
import { getDict } from "@/lib/i18n";

describe("i18n dictionaries", () => {
  const ko = getDict("ko");
  const ja = getDict("ja");

  it("Korean and Japanese define exactly the same keys", () => {
    expect(Object.keys(ja).sort()).toEqual(Object.keys(ko).sort());
  });

  it("has no empty strings in either language", () => {
    for (const dict of [ko, ja]) {
      for (const [key, value] of Object.entries(dict)) {
        if (typeof value === "string") {
          expect(value.trim(), `empty value for "${key}"`).not.toBe("");
        }
      }
    }
  });

  it("message functions fill in their numbers", () => {
    expect(ko.questionListProgress(3, 106)).toContain("3");
    expect(ja.questionListProgress(3, 106)).toContain("106");
    expect(ko.loginErrorRateLimited(5)).toContain("5");
    expect(ja.loginErrorRateLimited(5)).toContain("5");
  });
});

const HANGUL = /[가-힣ᄀ-ᇿ㄰-㆏]/;
const KANA = /[぀-ヿ]/;

function strings(dict: object): [string, string][] {
  return Object.entries(dict).flatMap(([k, v]) => {
    if (typeof v === "string") return [[k, v] as [string, string]];
    if (typeof v === "function") {
      // Message functions: render with sample numbers.
      const out = (v as (...a: number[]) => unknown)(1, 2, 3, 4);
      return typeof out === "string" ? [[k, out] as [string, string]] : [];
    }
    return [];
  });
}

describe("no mixed-language text", () => {
  it("Japanese UI text contains no Korean", () => {
    for (const [key, text] of strings(getDict("ja"))) {
      expect(HANGUL.test(text), `ja.${key}: ${text}`).toBe(false);
    }
  });

  it("Korean UI text contains no Japanese kana", () => {
    for (const [key, text] of strings(getDict("ko"))) {
      expect(KANA.test(text), `ko.${key}: ${text}`).toBe(false);
    }
  });

  it("question bank: Japanese has no Korean, Korean has no kana", async () => {
    const bank = (await import("@/data/question_bank.json")).default as {
      life_stage_ko: string;
      life_stage_ja: string;
      life_stage_short_ko: string;
      life_stage_short_ja: string;
      description_ko?: string;
      description_ja?: string;
      questions: { question_ko: string; question_ja: string }[];
    }[];
    for (const s of bank) {
      const ja = [s.life_stage_ja, s.life_stage_short_ja, s.description_ja ?? "", ...s.questions.map((q) => q.question_ja)];
      const ko = [s.life_stage_ko, s.life_stage_short_ko, s.description_ko ?? "", ...s.questions.map((q) => q.question_ko)];
      for (const t of ja) expect(HANGUL.test(t), t).toBe(false);
      for (const t of ko) expect(KANA.test(t), t).toBe(false);
    }
  });
});
