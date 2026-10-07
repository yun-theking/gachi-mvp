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
