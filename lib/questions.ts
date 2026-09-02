import { getDb } from "./db";
import type { Lang } from "./auth";

export const TOTAL_STAGES = 10;

/** Full life-stage names used as archive section headers, per language. */
export const STAGE_NAMES: Record<Lang, Record<number, string>> = {
  ko: {
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
  },
  ja: {
    1: "幼少期・成長背景",
    2: "学生時代・青年期",
    3: "社会人初期・入社/創業初期",
    4: "成長期のキャリア・挑戦と失敗",
    5: "全盛期・リーダーシップと決断",
    6: "危機と試練・克服",
    7: "人間関係・恩師と同僚",
    8: "家庭・結婚と私生活",
    9: "価値観・人生哲学",
    10: "引退後・後世への言葉",
  },
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
  question_ja: string;
  transcript: string;
  chapter: string;
  created_at: string;
}

export interface StagePosition {
  position: number;
  total: number;
}

/** Lowest-numbered life stage that still has unanswered (and unskipped) questions for
 * this user, or null if all 106 are resolved. */
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
        AND q.id NOT IN (
          SELECT question_id FROM skipped_questions WHERE user_id = ?
        )
      ORDER BY q.id
    `,
    args: [stageId, userId, userId],
  });
  return result.rows as unknown as QuestionRow[];
}

export async function getAllQuestionsInStage(stageId: number): Promise<QuestionRow[]> {
  const db = await getDb();
  const result = await db.execute({
    sql: "SELECT * FROM questions WHERE life_stage_id = ? ORDER BY id",
    args: [stageId],
  });
  return result.rows as unknown as QuestionRow[];
}

/** Question's position within its own life stage, e.g. "3번째 / 11개". Used for the
 * "OO개 질문 중 N번째" progress line — this is per-stage, not the overall 106 count. */
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
export async function getLastAnsweredEntry(userId: string): Promise<EntryRow | null> {
  const db = await getDb();
  const result = await db.execute({
    sql: "SELECT * FROM entries WHERE user_id = ? ORDER BY id DESC LIMIT 1",
    args: [userId],
  });
  return (result.rows[0] as unknown as EntryRow | undefined) ?? null;
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
