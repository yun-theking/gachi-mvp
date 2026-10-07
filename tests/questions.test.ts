import { describe, it, expect } from "vitest";
import bank from "@/data/question_bank.json";
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
} from "@/lib/questions";

const TOTAL_QUESTIONS = bank.reduce((n, s) => n + s.questions.length, 0);

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

describe("question bank seeding", () => {
  it("loads every question from question_bank.json", async () => {
    const user = await newUser();
    const all = await getAllQuestionsWithStatus(user);
    expect(all).toHaveLength(TOTAL_QUESTIONS);
    expect(all[0].question_ko).toBe(bank[0].questions[0].question_ko);
  });
});

describe("answering", () => {
  it("a new user starts at the first question with nothing answered", async () => {
    const user = await newUser();
    const next = await pickNextQuestion(user);
    expect(next?.id).toBe(1);
    expect((await getProgressSummary(user)).totalAnswered).toBe(0);
  });

  it("answered questions are flagged in the full list and leave the pool", async () => {
    const user = await newUser();
    await answer(user, 1);
    const all = await getAllQuestionsWithStatus(user);
    expect(all.find((q) => q.id === 1)?.answered).toBe(true);
    expect(all.find((q) => q.id === 2)?.answered).toBe(false);
    const remaining = await getRemainingQuestions(user, 1);
    expect(remaining.some((q) => q.id === 1)).toBe(false);
  });

  it("re-answering a question overwrites it instead of adding a duplicate", async () => {
    const user = await newUser();
    await answer(user, 3, "처음 답변");
    await answer(user, 3, "고친 답변");
    expect((await getProgressSummary(user)).totalAnswered).toBe(1);
    const entry = await getEntryByQuestionId(user, 3);
    expect(entry?.transcript).toBe("고친 답변");
  });

  it("one user's answers never show up for another user", async () => {
    const a = await newUser();
    const b = await newUser();
    await answer(a, 1);
    expect(await getEntryByQuestionId(b, 1)).toBeNull();
    expect((await getAllQuestionsWithStatus(b)).every((q) => !q.answered)).toBe(true);
  });

  it("skipped questions leave the pool but aren't counted as answered", async () => {
    const user = await newUser();
    await skipQuestion(user, 1);
    expect((await pickNextQuestion(user))?.id).not.toBe(1);
    expect((await getProgressSummary(user)).totalAnswered).toBe(0);
  });
});

describe("recent answers (AI context, '이전 질문')", () => {
  it("returns the most recent answers newest first", async () => {
    const user = await newUser();
    await answer(user, 1, "첫째");
    await answer(user, 2, "둘째");
    await answer(user, 3, "셋째");
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
