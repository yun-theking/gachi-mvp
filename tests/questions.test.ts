import { describe, it, expect } from "vitest";
import {
  registerUser,
  saveEntry,
  skipQuestion,
  getAllQuestionsWithStatus,
  getEntryByQuestionId,
  getRecentEntries,
  getLastAnsweredEntry,
  getProgressSummary,
  getRemainingQuestions,
  pickNextQuestion,
  getQuestionById,
  getUserFields,
  setUserFields,
  getCurrentStageId,
} from "@/lib/questions";

const FIRST_COMMON_QUESTION = 10101; // stage 1, question 1
const FIRST_SELF_EMPLOYED_QUESTION = 20101; // field B, question 1

// Each test uses its own user id, so they don't interfere through the
// shared in-memory DB.
let n = 0;
async function newUser() {
  const id = String(1000 + ++n);
  await registerUser(id, "ko");
  return id;
}

async function answer(userId: string, questionId: number, transcript = "답변") {
  const q = (await getQuestionById(questionId))!;
  await saveEntry({
    userId,
    questionId,
    lifeStageId: q.life_stage_id,
    questionKo: q.question_ko,
    questionJa: q.question_ja,
    transcript,
    chapter: `챕터: ${transcript}`,
  });
}

describe("question visibility by field", () => {
  it("a new user hasn't picked fields yet and sees only the 50 common questions", async () => {
    const user = await newUser();
    expect(await getUserFields(user)).toBeNull();
    const all = await getAllQuestionsWithStatus(user);
    expect(all).toHaveLength(50);
    expect(all[0].id).toBe(FIRST_COMMON_QUESTION);
  });

  it("picking fields adds 8 questions each, after the common ones", async () => {
    const user = await newUser();
    await setUserFields(user, ["I", "B"]);
    expect(await getUserFields(user)).toEqual(["B", "I"]);
    const all = await getAllQuestionsWithStatus(user);
    expect(all).toHaveLength(66);
    expect(all[50].id).toBe(FIRST_SELF_EMPLOYED_QUESTION);
    expect((await getProgressSummary(user)).totalQuestions).toBe(66);
  });

  it("choosing 'none' is remembered (not asked again) and shows common only", async () => {
    const user = await newUser();
    await setUserFields(user, []);
    expect(await getUserFields(user)).toEqual([]);
    expect(await getAllQuestionsWithStatus(user)).toHaveLength(50);
  });

  it("field questions come up after every common question is done", async () => {
    const user = await newUser();
    await setUserFields(user, ["B"]);
    for (const q of await getAllQuestionsWithStatus(user)) {
      if (q.life_stage_id <= 10) await answer(user, q.id);
    }
    expect(await getCurrentStageId(user)).toBe(102);
    expect((await pickNextQuestion(user))?.id).toBe(FIRST_SELF_EMPLOYED_QUESTION);
  });
});

describe("answering", () => {
  it("a new user starts at the first question with nothing answered", async () => {
    const user = await newUser();
    const next = await pickNextQuestion(user);
    expect(next?.id).toBe(FIRST_COMMON_QUESTION);
    expect((await getProgressSummary(user)).totalAnswered).toBe(0);
  });

  it("answered questions are flagged in the full list and leave the pool", async () => {
    const user = await newUser();
    await answer(user, 10101);
    const all = await getAllQuestionsWithStatus(user);
    expect(all.find((q) => q.id === 10101)?.answered).toBe(true);
    expect(all.find((q) => q.id === 10102)?.answered).toBe(false);
    const remaining = await getRemainingQuestions(user, 1);
    expect(remaining.some((q) => q.id === 10101)).toBe(false);
  });

  it("re-answering a question overwrites it instead of adding a duplicate", async () => {
    const user = await newUser();
    await answer(user, 10103, "처음 답변");
    await answer(user, 10103, "고친 답변");
    expect((await getProgressSummary(user)).totalAnswered).toBe(1);
    const entry = await getEntryByQuestionId(user, 10103);
    expect(entry?.transcript).toBe("고친 답변");
  });

  it("one user's answers never show up for another user", async () => {
    const a = await newUser();
    const b = await newUser();
    await answer(a, 10101);
    expect(await getEntryByQuestionId(b, 10101)).toBeNull();
    expect((await getAllQuestionsWithStatus(b)).every((q) => !q.answered)).toBe(true);
  });

  it("skipped questions leave the pool but aren't counted as answered", async () => {
    const user = await newUser();
    await skipQuestion(user, 10101);
    expect((await pickNextQuestion(user))?.id).not.toBe(10101);
    expect((await getProgressSummary(user)).totalAnswered).toBe(0);
  });
});

describe("recent answers (AI context, '이전 질문')", () => {
  it("returns the most recent answers newest first", async () => {
    const user = await newUser();
    await answer(user, 10101, "첫째");
    await answer(user, 10102, "둘째");
    await answer(user, 10103, "셋째");
    const recent = await getRecentEntries(user, 2);
    expect(recent.map((e) => e.transcript)).toEqual(["셋째", "둘째"]);
    expect((await getLastAnsweredEntry(user))?.transcript).toBe("셋째");
  });

  it("has nothing for a user who hasn't answered yet", async () => {
    const user = await newUser();
    expect(await getRecentEntries(user, 4)).toEqual([]);
    expect(await getLastAnsweredEntry(user)).toBeNull();
  });
});
