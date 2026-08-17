import { getDb } from "./db";

export const TOTAL_STAGES = 10;

export const STAGE_NAMES: Record<number, string> = {
  1: "유년기·성장배경",
  2: "학창시절·청년기",
  3: "사회초년·입사/창업초기",
  4: "성장기 커리어·도전과 실패",
  5: "전성기·리더십과 결단",
  6: "위기와 시련·극복",
  7: "인간관계·은사와 동료",
  8: "가정·결혼과 사생활",
  9: "가치관·인생철학",
  10: "은퇴 이후·후대에 남기는 말",
};

export interface QuestionRow {
  id: number;
  life_stage_id: number;
  life_stage_ko: string;
  life_stage_ja: string;
  question_ko: string;
  question_ja: string;
}

export interface EntryRow {
  id: number;
  user_id: string;
  question_id: number | null;
  life_stage_id: number;
  question_ko: string;
  transcript: string;
  chapter: string;
  created_at: string;
}

/** Lowest-numbered life stage that still has unanswered questions for this user, or null if all 106 are done. */
export async function getCurrentStageId(userId: string): Promise<number | null> {
  for (let stage = 1; stage <= TOTAL_STAGES; stage++) {
    if ((await getRemainingQuestions(userId, stage)).length > 0) return stage;
  }
  return null;
}

export async function getRemainingQuestions(
  userId: string,
  stageId: number
): Promise<QuestionRow[]> {
  const db = await getDb();
  const result = await db.execute({
    sql: `
      SELECT q.* FROM questions q
      WHERE q.life_stage_id = ?
        AND q.id NOT IN (
          SELECT question_id FROM entries
          WHERE question_id IS NOT NULL AND user_id = ?
        )
      ORDER BY q.id
    `,
    args: [stageId, userId],
  });
  return result.rows as unknown as QuestionRow[];
}

export async function getQuestionById(id: number): Promise<QuestionRow | undefined> {
  const db = await getDb();
  const result = await db.execute({
    sql: "SELECT * FROM questions WHERE id = ?",
    args: [id],
  });
  return result.rows[0] as unknown as QuestionRow | undefined;
}

export async function saveEntry(entry: {
  userId: string;
  questionId: number | null;
  lifeStageId: number;
  questionKo: string;
  transcript: string;
  chapter: string;
}) {
  const db = await getDb();
  await db.execute({
    sql: `INSERT INTO entries (user_id, question_id, life_stage_id, question_ko, transcript, chapter)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      entry.userId,
      entry.questionId,
      entry.lifeStageId,
      entry.questionKo,
      entry.transcript,
      entry.chapter,
    ],
  });
}

export async function getAllEntries(userId: string): Promise<EntryRow[]> {
  const db = await getDb();
  const result = await db.execute({
    sql: "SELECT * FROM entries WHERE user_id = ? ORDER BY life_stage_id ASC, id ASC",
    args: [userId],
  });
  return result.rows as unknown as EntryRow[];
}

export async function getProgressSummary(userId: string) {
  const db = await getDb();
  const totalAnsweredResult = await db.execute({
    sql: "SELECT COUNT(*) as c FROM entries WHERE user_id = ?",
    args: [userId],
  });
  const totalQuestionsResult = await db.execute("SELECT COUNT(*) as c FROM questions");
  return {
    totalAnswered: Number(totalAnsweredResult.rows[0].c as number),
    totalQuestions: Number(totalQuestionsResult.rows[0].c as number),
  };
}

/** Pick the next question to ask this user: first unanswered question in their current stage. */
export async function pickNextQuestion(userId: string): Promise<QuestionRow | null> {
  const stageId = await getCurrentStageId(userId);
  if (stageId === null) return null;
  const remaining = await getRemainingQuestions(userId, stageId);
  return remaining[0] ?? null;
}

/** Register a personal ID on first login (no-op if it already exists). */
export async function registerUser(userId: string) {
  const db = await getDb();
  await db.execute({
    sql: "INSERT INTO users (id) VALUES (?) ON CONFLICT(id) DO NOTHING",
    args: [userId],
  });
}
