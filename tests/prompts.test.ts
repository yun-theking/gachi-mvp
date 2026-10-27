import { describe, it, expect } from "vitest";
import { validateReview, chapterMaxTokens, chapterPrompt, reviewPrompt } from "@/lib/prompts";

const RAW = "나는 대학 졸업하고 동네 약국에서 페의학사로 일했다 한 십년 정도";

describe("transcript review checks", () => {
  it("keeps a word-level fix and lists it", () => {
    const fixed = "나는 대학 졸업하고 동네 약국에서 페이약사로 일했다. 한 십년 정도.";
    const r = validateReview(RAW, {
      text: fixed,
      corrections: [{ from: "페의학사", to: "페이약사" }],
      uncertain: [],
    });
    expect(r.text).toBe(fixed);
    expect(r.corrections).toEqual([{ from: "페의학사", to: "페이약사" }]);
  });

  it("falls back to the raw text if the model summarised or rewrote it", () => {
    expect(validateReview(RAW, { text: "약국에서 일했다.", corrections: [], uncertain: [] }).text).toBe(RAW);
    expect(validateReview(RAW, { text: RAW + " 그 시절은 정말 행복하고 아름다운 나날이었다.", corrections: [], uncertain: [] }).text).toBe(RAW);
  });

  it("falls back on malformed output", () => {
    expect(validateReview(RAW, null).text).toBe(RAW);
    expect(validateReview(RAW, { text: 42 }).text).toBe(RAW);
  });

  it("drops corrections and flags that don't match the text", () => {
    const r = validateReview(RAW, {
      text: RAW,
      corrections: [{ from: "x", to: "없는말" }, { from: "같음", to: "같음" }, "bad"],
      uncertain: ["페의학사", "없는단어", "페의학사", 3],
    });
    expect(r.corrections).toEqual([]);
    expect(r.uncertain).toEqual(["페의학사"]);
  });
});

describe("chapter length budget", () => {
  it("grows with the answer so long answers aren't cut off, within a cap", () => {
    expect(chapterMaxTokens("짧은 답")).toBeLessThan(chapterMaxTokens("가".repeat(1500)));
    expect(chapterMaxTokens("가".repeat(1500))).toBeGreaterThanOrEqual(1500 + 300);
    expect(chapterMaxTokens("가".repeat(100000))).toBe(4000);
  });
});

describe("prompt rules", () => {
  const q = { asked: "Q", recent: "", candidates: "- id:1 \"Q2\"" };

  it("Korean chapters: facts only, book style (~했다), no fixed length", () => {
    const p = chapterPrompt("ko", q);
    expect(p).toContain("지어내거나");
    expect(p).toContain("~했다");
    expect(p).toContain("답변의 양에 맞추세요");
    expect(p).not.toMatch(/\d+~\d+자/);
  });

  it("Japanese chapters: facts only, だ・である style, no fixed length", () => {
    const p = chapterPrompt("ja", q);
    expect(p).toContain("創作");
    expect(p).toContain("だ・である調");
    expect(p).toContain("回答の量に合わせて");
    expect(p).not.toMatch(/\d+〜\d+字/);
  });

  it("review prompt includes the question and field as context", () => {
    const p = reviewPrompt("ko", "첫 직장은?", "자영업");
    expect(p).toContain("첫 직장은?");
    expect(p).toContain("자영업");
  });
});
