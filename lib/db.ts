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

  await db.execute(
    `CREATE TABLE IF NOT EXISTS login_rate_limit (
       ip TEXT PRIMARY KEY,
       count INTEGER NOT NULL DEFAULT 0,
       window_start TEXT NOT NULL DEFAULT (datetime('now'))
     )`
  );
}

async function seedQuestions(db: Client) {
  const result = await db.execute("SELECT COUNT(*) as count FROM questions");
  const count = Number(result.rows[0].count as number);
  if (count > 0) return;

  const bank: BankStage[] = JSON.parse(fs.readFileSync(BANK_PATH, "utf-8"));

  let globalId = 1;
  const statements: { sql: string; args: (string | number)[] }[] = [];
  for (const stage of bank) {
    for (const q of stage.questions) {
      statements.push({
        sql: `INSERT INTO questions (id, life_stage_id, life_stage_ko, life_stage_ja, question_ko, question_ja)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [
          globalId++,
          stage.life_stage_id,
          stage.life_stage_ko,
          stage.life_stage_ja,
          q.question_ko,
          q.question_ja,
        ],
      });
    }
  }
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
