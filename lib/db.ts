import { DatabaseSync } from "node:sqlite";
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
  var __gachiDb: DatabaseSync | undefined;
}

function createSchema(db: DatabaseSync) {
  db.exec(`
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
      question_id INTEGER REFERENCES questions(id),
      life_stage_id INTEGER NOT NULL,
      question_ko TEXT NOT NULL,
      transcript TEXT NOT NULL,
      chapter TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function seedQuestions(db: DatabaseSync) {
  const row = db.prepare("SELECT COUNT(*) as count FROM questions").get() as {
    count: number;
  };
  if (row.count > 0) return;

  const bank: BankStage[] = JSON.parse(fs.readFileSync(BANK_PATH, "utf-8"));
  const insert = db.prepare(
    `INSERT INTO questions (id, life_stage_id, life_stage_ko, life_stage_ja, question_ko, question_ja)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  let globalId = 1;
  for (const stage of bank) {
    for (const q of stage.questions) {
      insert.run(
        globalId++,
        stage.life_stage_id,
        stage.life_stage_ko,
        stage.life_stage_ja,
        q.question_ko,
        q.question_ja
      );
    }
  }
}

/** Singleton connection, cached on globalThis so Next.js dev hot-reload
 * doesn't reopen (and re-lock) the sqlite file on every request. */
export function getDb(): DatabaseSync {
  if (!global.__gachiDb) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    const db = new DatabaseSync(DB_PATH);
    createSchema(db);
    seedQuestions(db);
    global.__gachiDb = db;
  }
  return global.__gachiDb;
}
