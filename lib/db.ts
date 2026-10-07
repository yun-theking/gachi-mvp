import { createClient, type Client } from "@libsql/client";
import path from "node:path";
import fs from "node:fs";

const DB_PATH = path.join(process.cwd(), "data", "gachi.db");
const BANK_PATH = path.join(process.cwd(), "data", "question_bank.json");

interface BankQuestion {
  id: number;
  question_ko: string;
  question_ja: string;
}

interface BankStage {
  life_stage_id: number;
  field_code?: string;
  life_stage_ko: string;
  life_stage_ja: string;
  questions: BankQuestion[];
}

declare global {
  // eslint-disable-next-line no-var
  var __gachiDb: Client | undefined;
  // eslint-disable-next-line no-var
  var __gachiDbReady: Promise<void> | undefined;
}

/**
 * Picks the right backend automatically:
 * - TURSO_DATABASE_URL set (production / Vercel)  -> remote Turso (libSQL) DB
 * - not set (local dev)                            -> plain SQLite file on disk
 * Same client, same query API either way — no code branching anywhere else.
 */
function makeClient(): Client {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (url) {
    return createClient({ url, authToken });
  }

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  return createClient({ url: `file:${DB_PATH}` });
}

async function createSchema(db: Client) {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY,
      life_stage_id INTEGER NOT NULL,
      life_stage_ko TEXT NOT NULL,
      life_stage_ja TEXT NOT NULL,
      question_ko TEXT NOT NULL,
      question_ja TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL DEFAULT '0',
      question_id INTEGER REFERENCES questions(id),
      life_stage_id INTEGER NOT NULL,
      question_ko TEXT NOT NULL,
      question_ja TEXT NOT NULL DEFAULT '',
      transcript TEXT NOT NULL,
      chapter TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      language TEXT NOT NULL DEFAULT 'ko',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Beta login has no separate password: the 4-digit number itself is the
    -- credential. This throttles how fast one IP can try different numbers,
    -- so scanning the full 0000-9999 space to find live accounts is slow.
    CREATE TABLE IF NOT EXISTS login_rate_limit (
      ip TEXT PRIMARY KEY,
      count INTEGER NOT NULL DEFAULT 0,
      window_start TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS skipped_questions (
      user_id TEXT NOT NULL,
      question_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, question_id)
    );
  `);
}

/** entries table existed before user_id was introduced — add the column on old DBs
 * (both the local file and the already-deployed Turso DB) instead of recreating. */
async function migrateSchema(db: Client) {
  const info = await db.execute("PRAGMA table_info(entries)");
  const hasUserId = info.rows.some((r) => (r as unknown as { name: string }).name === "user_id");
  if (!hasUserId) {
    await db.execute("ALTER TABLE entries ADD COLUMN user_id TEXT NOT NULL DEFAULT '0'");
  }

  // Lets saveEntry() upsert: redoing a previously-answered question overwrites
  // that row instead of creating a duplicate. NULLs (free-form answers with no
  // question_id) are excluded so they never collide with each other.
  await db.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_entries_user_question
     ON entries(user_id, question_id) WHERE question_id IS NOT NULL`
  );

  await db.execute(
    `CREATE TABLE IF NOT EXISTS skipped_questions (
       user_id TEXT NOT NULL,
       question_id INTEGER NOT NULL,
       created_at TEXT NOT NULL DEFAULT (datetime('now')),
       PRIMARY KEY (user_id, question_id)
     )`
  );

  const entryCols = await db.execute("PRAGMA table_info(entries)");
  const hasQuestionJa = entryCols.rows.some(
    (r) => (r as unknown as { name: string }).name === "question_ja"
  );
  if (!hasQuestionJa) {
    await db.execute("ALTER TABLE entries ADD COLUMN question_ja TEXT NOT NULL DEFAULT ''");
  }

  const userCols = await db.execute("PRAGMA table_info(users)");
  const hasLanguage = userCols.rows.some(
    (r) => (r as unknown as { name: string }).name === "language"
  );
  if (!hasLanguage) {
    await db.execute("ALTER TABLE users ADD COLUMN language TEXT NOT NULL DEFAULT 'ko'");
  }

  const questionCols = await db.execute("PRAGMA table_info(questions)");
  const qColNames = questionCols.rows.map((r) => (r as unknown as { name: string }).name);
  if (!qColNames.includes("field_code")) {
    // NULL = common question (everyone); otherwise the field group it belongs to.
    await db.execute("ALTER TABLE questions ADD COLUMN field_code TEXT");
  }
  if (!qColNames.includes("active")) {
    // 0 = no longer in question_bank.json, but kept because someone answered it.
    await db.execute("ALTER TABLE questions ADD COLUMN active INTEGER NOT NULL DEFAULT 1");
  }

  const userColNames = (await db.execute("PRAGMA table_info(users)")).rows.map(
    (r) => (r as unknown as { name: string }).name
  );
  if (!userColNames.includes("onboarding_seen")) {
    // Tutorial shown/skipped for this account (per account, not per device).
    await db.execute("ALTER TABLE users ADD COLUMN onboarding_seen INTEGER NOT NULL DEFAULT 0");
  }
  if (!userColNames.includes("fields")) {
    // Comma-separated field codes. NULL = not asked yet, "" = chose none.
    await db.execute("ALTER TABLE users ADD COLUMN fields TEXT");
  }

  await db.execute(
    `CREATE TABLE IF NOT EXISTS login_rate_limit (
       ip TEXT PRIMARY KEY,
       count INTEGER NOT NULL DEFAULT 0,
       window_start TEXT NOT NULL DEFAULT (datetime('now'))
     )`
  );
}

/**
 * Syncs the questions table from data/question_bank.json on every startup,
 * so the JSON is the source of truth: editing, adding or removing questions
 * there shows up without wiping the DB.
 *
 * Every question has a fixed id in the JSON (not its position), so adding or
 * reordering questions never re-points existing answers at different ones.
 * Questions that disappear from the JSON are deleted, or — if someone has
 * already answered them — kept but marked inactive, so they leave every
 * question list while the answers stay in the archive.
 */
async function seedQuestions(db: Client) {
  const bank: BankStage[] = JSON.parse(fs.readFileSync(BANK_PATH, "utf-8"));

  const statements: { sql: string; args: (string | number | null)[] }[] = [
    { sql: "UPDATE questions SET active = 0", args: [] },
  ];
  for (const stage of bank) {
    for (const q of stage.questions) {
      statements.push({
        sql: `INSERT INTO questions (id, life_stage_id, life_stage_ko, life_stage_ja, question_ko, question_ja, field_code, active)
              VALUES (?, ?, ?, ?, ?, ?, ?, 1)
              ON CONFLICT(id) DO UPDATE SET
                life_stage_id = excluded.life_stage_id,
                life_stage_ko = excluded.life_stage_ko,
                life_stage_ja = excluded.life_stage_ja,
                question_ko = excluded.question_ko,
                question_ja = excluded.question_ja,
                field_code = excluded.field_code,
                active = 1`,
        args: [
          q.id,
          stage.life_stage_id,
          stage.life_stage_ko,
          stage.life_stage_ja,
          q.question_ko,
          q.question_ja,
          stage.field_code ?? null,
        ],
      });
    }
  }
  statements.push({
    sql: `DELETE FROM questions
          WHERE active = 0
            AND id NOT IN (SELECT question_id FROM entries WHERE question_id IS NOT NULL)`,
    args: [],
  });
  await db.batch(statements, "write");
}

/** Singleton connection + one-time schema/seed init, cached on globalThis so
 * Next.js dev hot-reload doesn't reopen the connection or re-seed on every request. */
export async function getDb(): Promise<Client> {
  if (!global.__gachiDb) {
    global.__gachiDb = makeClient();
  }
  if (!global.__gachiDbReady) {
    global.__gachiDbReady = (async () => {
      await createSchema(global.__gachiDb!);
      await migrateSchema(global.__gachiDb!);
      await seedQuestions(global.__gachiDb!);
    })();
  }
  await global.__gachiDbReady;
  return global.__gachiDb;
}
