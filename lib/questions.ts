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
export function getCurrentStageId(): number | null {
  for (let stage = 1; stage <= TOTAL_STAGES; stage++) {
    if (getRemainingQuestions(stage).length > 0) return stage;
  }
  return null;
}

export function getRemainingQuestions(stageId: number): QuestionRow[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT q.* FROM questions q
    WHERE q.life_stage_id = ?
      AND q.id NOT IN (SELECT question_id FROM entries WHERE question_id IS NOT NULL)
    ORDER BY q.id
  `);
  return stmt.all(stageId) as unknown as QuestionRow[];
}

export function getQuestionById(id: number): QuestionRow | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM questions WHERE id = ?").get(id) as
    | QuestionRow
    | undefined;
}

export function saveEntry(entry: {
  questionId: number | null;
  lifeStageId: number;
  questionKo: string;
  transcript: string;
  chapter: string;
}) {
  const db = getDb();
  db.prepare(
    `INSERT INTO entries (question_id, life_stage_id, question_ko, transcript, chapter)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    entry.questionId,
    entry.lifeStageId,
    entry.questionKo,
    entry.transcript,
    entry.chapter
  );
}

export function getAllEntries(): EntryRow[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM entries ORDER BY life_stage_id ASC, id ASC")
    .all() as unknown as EntryRow[];
}

export function getProgressSummary() {
  const db = getDb();
  const totalAnswered = (
    db.prepare("SELECT COUNT(*) as c FROM entries").get() as { c: number }
  ).c;
  const totalQuestions = (
    db.prepare("SELECT COUNT(*) as c FROM questions").get() as { c: number }
  ).c;
  return { totalAnswered, totalQuestions };
}

/** Pick the next question to ask: first unanswered question in the current stage. */
export function pickNextQuestion(): QuestionRow | null {
  const stageId = getCurrentStageId();
  if (stageId === null) return null;
  const remaining = getRemainingQuestions(stageId);
  return remaining[0] ?? null;
}
