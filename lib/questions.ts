import { getDb } from "./db";

export const TOTAL_STAGES = 10;

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
  question_id: number | null;
  life_stage_id: number;
  question_ko: string;
  transcript: string;
  chapter: string;
  created_at: string;
}

/** Lowest-numbered life stage that still has unanswered questions, or null if all 106 are done. */
export async function getCurrentStageId(): Promise<number | null> {
  for (let stage = 1; stage <= TOTAL_STAGES; stage++) {
    if ((await getRemainingQuestions(stage)).length > 0) return stage;
  }
  return null;
}

export async function getRemainingQuestions(stageId: number): Promise<QuestionRow[]> {
  const db = await getDb();
  const result = await db.execute({
    sql: `
      SELECT q.* FROM questions q
      WHERE q.life_stage_id = ?
        AND q.id NOT IN (SELECT question_id FROM entries WHERE question_id IS NOT NULL)
      ORDER BY q.id
    `,
    args: [stageId],
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
  questionId: number | null;
  lifeStageId: number;
  questionKo: string;
  transcript: string;
  chapter: string;
}) {
  const db = await getDb();
  await db.execute({
    sql: `INSERT INTO entries (question_id, life_stage_id, question_ko, transcript, chapter)
          VALUES (?, ?, ?, ?, ?)`,
    args: [
      entry.questionId,
      entry.lifeStageId,
      entry.questionKo,
      entry.transcript,
      entry.chapter,
    ],
  });
}

export async function getAllEntries(): Promise<EntryRow[]> {
  const db = await getDb();
  const result = await db.execute(
    "SELECT * FROM entries ORDER BY life_stage_id ASC, id ASC"
  );
  return result.rows as unknown as EntryRow[];
}

export async function getProgressSummary() {
  const db = await getDb();
  const totalAnsweredResult = await db.execute("SELECT COUNT(*) as c FROM entries");
  const totalQuestionsResult = await db.execute("SELECT COUNT(*) as c FROM questions");
  return {
    totalAnswered: Number(totalAnsweredResult.rows[0].c as number),
    totalQuestions: Number(totalQuestionsResult.rows[0].c as number),
  };
}

/** Pick the next question to ask: first unanswered question in the current stage. */
export async function pickNextQuestion(): Promise<QuestionRow | null> {
  const stageId = await getCurrentStageId();
  if (stageId === null) return null;
  const remaining = await getRemainingQuestions(stageId);
  return remaining[0] ?? null;
}
