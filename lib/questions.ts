import { getDb } from "./db";
import type { Lang } from "./auth";
import { visibleStageIds, parseFields, serializeFields } from "./stages";

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
  question_ja: string;
  transcript: string;
  chapter: string;
  created_at: string;
}

export interface StagePosition {
  position: number;
  total: number;
}

/** The field groups this person picked. null = they haven't been asked yet
 * (send them to the field picker); [] = they chose "none of these". */
export async function getUserFields(userId: string): Promise<string[] | null> {
  const db = await getDb();
  const result = await db.execute({ sql: "SELECT fields FROM users WHERE id = ?", args: [userId] });
  const row = result.rows[0] as unknown as { fields: string | null } | undefined;
  return parseFields(row?.fields ?? null);
}

export async function setUserFields(userId: string, fields: string[]) {
  const db = await getDb();
  await db.execute({
    sql: "UPDATE users SET fields = ? WHERE id = ?",
    args: [serializeFields(fields), userId],
  });
}

/** Section ids this person sees, in interview order (common stages, then
 * their picked fields). */
export async function getVisibleStageIds(userId: string): Promise<number[]> {
  return visibleStageIds((await getUserFields(userId)) ?? []);
}

/** First section (in interview order) that still has unanswered, unskipped
 * questions for this user, or null if they've been through everything. */
export async function getCurrentStageId(userId: string): Promise<number | null> {
  for (const stage of await getVisibleStageIds(userId)) {
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
        AND q.active = 1
        AND q.id NOT IN (
          SELECT question_id FROM entries
          WHERE question_id IS NOT NULL AND user_id = ?
        )
        AND q.id NOT IN (
          SELECT question_id FROM skipped_questions WHERE user_id = ?
        )
      ORDER BY q.id
    `,
    args: [stageId, userId, userId],
  });
  return result.rows as unknown as QuestionRow[];
}

export interface QuestionWithStatus extends QuestionRow {
  answered: boolean;
}

/** Every question this person can see (common + their picked fields), in
 * interview order, each flagged with whether they've answered it. Backs the
 * "pick any question" list — unlike getRemainingQuestions, this includes
 * answered (and skipped) questions too, since the list shows the full set. */
export async function getAllQuestionsWithStatus(userId: string): Promise<QuestionWithStatus[]> {
  const db = await getDb();
  const stageIds = await getVisibleStageIds(userId);
  const result = await db.execute({
    sql: `
      SELECT q.*, CASE WHEN e.question_id IS NOT NULL THEN 1 ELSE 0 END as answered
      FROM questions q
      LEFT JOIN entries e ON e.question_id = q.id AND e.user_id = ?
      WHERE q.active = 1 AND q.life_stage_id IN (${stageIds.map(() => "?").join(",")})
      ORDER BY q.id
    `,
    args: [userId, ...stageIds],
  });
  const rows = (result.rows as unknown as (QuestionRow & { answered: number | boolean })[]).map(
    (r) => ({ ...r, answered: !!r.answered })
  );
  // Order by interview order (common stages, then fields as picked).
  const order = new Map(stageIds.map((id, i) => [id, i]));
  return rows.sort(
    (a, b) => order.get(a.life_stage_id)! - order.get(b.life_stage_id)! || a.id - b.id
  );
}

export async function getAllQuestionsInStage(stageId: number): Promise<QuestionRow[]> {
  const db = await getDb();
  const result = await db.execute({
    sql: "SELECT * FROM questions WHERE life_stage_id = ? AND active = 1 ORDER BY id",
    args: [stageId],
  });
  return result.rows as unknown as QuestionRow[];
}

/** Question's position within its own section, e.g. "3번째 / 5개". Used for the
 * "OO개 질문 중 N번째" progress line — per section, not the overall count. */
export async function getStagePosition(
  stageId: number,
  questionId: number
): Promise<StagePosition> {
  const all = await getAllQuestionsInStage(stageId);
  const idx = all.findIndex((q) => q.id === questionId);
  return { position: idx === -1 ? 1 : idx + 1, total: all.length };
}

export async function getQuestionById(id: number): Promise<QuestionRow | undefined> {
  const db = await getDb();
  const result = await db.execute({
    sql: "SELECT * FROM questions WHERE id = ?",
    args: [id],
  });
  return result.rows[0] as unknown as QuestionRow | undefined;
}

/** Insert a new answer, or overwrite the existing one if this (user, question) was
 * already answered before — this is what makes "이전 질문 다시 답변" work without
 * creating duplicate rows. */
export async function saveEntry(entry: {
  userId: string;
  questionId: number | null;
  lifeStageId: number;
  questionKo: string;
  questionJa: string;
  transcript: string;
  chapter: string;
}) {
  const db = await getDb();
  await db.execute({
    sql: `
      INSERT INTO entries (user_id, question_id, life_stage_id, question_ko, question_ja, transcript, chapter)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, question_id) WHERE question_id IS NOT NULL
      DO UPDATE SET
        life_stage_id = excluded.life_stage_id,
        question_ko = excluded.question_ko,
        question_ja = excluded.question_ja,
        transcript = excluded.transcript,
        chapter = excluded.chapter,
        created_at = datetime('now')
    `,
    args: [
      entry.userId,
      entry.questionId,
      entry.lifeStageId,
      entry.questionKo,
      entry.questionJa,
      entry.transcript,
      entry.chapter,
    ],
  });

  // Redoing a question that was previously skipped should un-skip it.
  if (entry.questionId !== null) {
    await db.execute({
      sql: "DELETE FROM skipped_questions WHERE user_id = ? AND question_id = ?",
      args: [entry.userId, entry.questionId],
    });
  }
}

/** Mark a question as skipped for this user so it's excluded from the pool without
 * an entry being created. Skipping something already answered is a no-op. */
export async function skipQuestion(userId: string, questionId: number) {
  const db = await getDb();
  const existing = await db.execute({
    sql: "SELECT 1 FROM entries WHERE user_id = ? AND question_id = ?",
    args: [userId, questionId],
  });
  if (existing.rows.length > 0) return;

  await db.execute({
    sql: "INSERT INTO skipped_questions (user_id, question_id) VALUES (?, ?) ON CONFLICT DO NOTHING",
    args: [userId, questionId],
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

/** Most recently answered entry — this is what the "이전 질문" button surfaces. */
/** This user's saved answer for one specific question, if any — used to
 * reopen any already-answered question for re-answering from the list. */
export async function getEntryByQuestionId(
  userId: string,
  questionId: number
): Promise<EntryRow | null> {
  const db = await getDb();
  const result = await db.execute({
    sql: "SELECT * FROM entries WHERE user_id = ? AND question_id = ? LIMIT 1",
    args: [userId, questionId],
  });
  return (result.rows[0] as unknown as EntryRow | undefined) ?? null;
}

/** This user's most recent answers, newest first — gives the AI the recent
 * conversation flow when picking the next question. Read from the DB rather
 * than kept in the browser, so it survives a page refresh. */
export async function getRecentEntries(userId: string, limit: number): Promise<EntryRow[]> {
  const db = await getDb();
  const result = await db.execute({
    sql: "SELECT * FROM entries WHERE user_id = ? ORDER BY id DESC LIMIT ?",
    args: [userId, limit],
  });
  return result.rows as unknown as EntryRow[];
}

export async function getLastAnsweredEntry(userId: string): Promise<EntryRow | null> {
  const db = await getDb();
  const result = await db.execute({
    sql: "SELECT * FROM entries WHERE user_id = ? ORDER BY id DESC LIMIT 1",
    args: [userId],
  });
  return (result.rows[0] as unknown as EntryRow | undefined) ?? null;
}

/** Answered vs. total, counted over the questions this person can see now
 * (so answers to retired questions or unpicked fields don't skew it). */
export async function getProgressSummary(userId: string) {
  const db = await getDb();
  const stageIds = await getVisibleStageIds(userId);
  const inStages = `q.active = 1 AND q.life_stage_id IN (${stageIds.map(() => "?").join(",")})`;
  const totalAnsweredResult = await db.execute({
    sql: `SELECT COUNT(*) as c FROM entries e JOIN questions q ON q.id = e.question_id
          WHERE e.user_id = ? AND ${inStages}`,
    args: [userId, ...stageIds],
  });
  const totalQuestionsResult = await db.execute({
    sql: `SELECT COUNT(*) as c FROM questions q WHERE ${inStages}`,
    args: stageIds,
  });
  return {
    totalAnswered: Number(totalAnsweredResult.rows[0].c as number),
    totalQuestions: Number(totalQuestionsResult.rows[0].c as number),
    totalStages: stageIds.length,
  };
}

/** Pick the next question to ask this user: first remaining question in their current stage. */
export async function pickNextQuestion(userId: string): Promise<QuestionRow | null> {
  const stageId = await getCurrentStageId(userId);
  if (stageId === null) return null;
  const remaining = await getRemainingQuestions(userId, stageId);
  return remaining[0] ?? null;
}

/** Register a personal ID on first login, or update its language preference on
 * subsequent logins (no-op on the id itself if it already exists). */
export async function registerUser(userId: string, language: Lang) {
  const db = await getDb();
  await db.execute({
    sql: `
      INSERT INTO users (id, language) VALUES (?, ?)
      ON CONFLICT(id) DO UPDATE SET language = excluded.language
    `,
    args: [userId, language],
  });
}

export async function userExists(userId: string): Promise<boolean> {
  const db = await getDb();
  const result = await db.execute({ sql: "SELECT 1 FROM users WHERE id = ?", args: [userId] });
  return result.rows.length > 0;
}

const RATE_LIMIT_WINDOW_MINUTES = 10;
const RATE_LIMIT_MAX_ATTEMPTS = 20;

/** Beta login has no separate password, so this throttles login POSTs per IP
 * instead — slows down scanning through the 4-digit number space to find
 * (and walk straight into) someone else's account. Sliding-ish fixed window:
 * count resets once RATE_LIMIT_WINDOW_MINUTES has passed since it started. */
export async function checkIpRateLimit(
  ip: string
): Promise<{ limited: boolean; retryAfterSeconds?: number }> {
  const db = await getDb();
  const result = await db.execute({
    sql: "SELECT count, window_start FROM login_rate_limit WHERE ip = ?",
    args: [ip],
  });
  const row = result.rows[0] as unknown as { count: number; window_start: string } | undefined;
  if (!row) return { limited: false };

  const windowStartMs = new Date(row.window_start + "Z").getTime();
  const elapsedMs = Date.now() - windowStartMs;
  const windowMs = RATE_LIMIT_WINDOW_MINUTES * 60 * 1000;

  if (elapsedMs >= windowMs) return { limited: false }; // window expired, will reset on next record

  if (Number(row.count) >= RATE_LIMIT_MAX_ATTEMPTS) {
    return { limited: true, retryAfterSeconds: Math.ceil((windowMs - elapsedMs) / 1000) };
  }
  return { limited: false };
}

/** Records one login POST from this IP, starting a fresh window if the
 * previous one expired. Call after checkIpRateLimit() passes. */
export async function recordIpLoginAttempt(ip: string) {
  const db = await getDb();
  const result = await db.execute({
    sql: "SELECT window_start FROM login_rate_limit WHERE ip = ?",
    args: [ip],
  });
  const row = result.rows[0] as unknown as { window_start: string } | undefined;
  const windowMs = RATE_LIMIT_WINDOW_MINUTES * 60 * 1000;
  const expired = row && Date.now() - new Date(row.window_start + "Z").getTime() >= windowMs;

  if (!row || expired) {
    await db.execute({
      sql: `
        INSERT INTO login_rate_limit (ip, count, window_start) VALUES (?, 1, datetime('now'))
        ON CONFLICT(ip) DO UPDATE SET count = 1, window_start = datetime('now')
      `,
      args: [ip],
    });
  } else {
    await db.execute({
      sql: "UPDATE login_rate_limit SET count = count + 1 WHERE ip = ?",
      args: [ip],
    });
  }
}

/** Admin-only: moves an account from oldId to newId, carrying over every
 * table that references the user, for when someone forgets their number.
 * Requires the admin to already know the old number (e.g. from a support
 * conversation) — this is not a self-service "forgot number" flow. */
export async function renameUser(oldId: string, newId: string) {
  const db = await getDb();
  await db.batch(
    [
      { sql: "UPDATE users SET id = ? WHERE id = ?", args: [newId, oldId] },
      { sql: "UPDATE entries SET user_id = ? WHERE user_id = ?", args: [newId, oldId] },
      {
        sql: "UPDATE skipped_questions SET user_id = ? WHERE user_id = ?",
        args: [newId, oldId],
      },
    ],
    "write"
  );
}
