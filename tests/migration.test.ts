import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@libsql/client";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

/**
 * Upgrading an existing database (like the deployed one) from the old
 * 106-question bank: old answers must survive, old questions must leave the
 * lists, and existing users must be sent to the field picker.
 */
const dbFile = path.join(os.tmpdir(), `gachi-migration-${Date.now()}.db`);

beforeAll(async () => {
  // Old schema: no questions.field_code/active, no users.fields.
  const old = createClient({ url: `file:${dbFile}` });
  await old.executeMultiple(`
    CREATE TABLE questions (id INTEGER PRIMARY KEY, life_stage_id INTEGER NOT NULL,
      life_stage_ko TEXT NOT NULL, life_stage_ja TEXT NOT NULL,
      question_ko TEXT NOT NULL, question_ja TEXT NOT NULL);
    CREATE TABLE entries (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL DEFAULT '0',
      question_id INTEGER REFERENCES questions(id), life_stage_id INTEGER NOT NULL,
      question_ko TEXT NOT NULL, question_ja TEXT NOT NULL DEFAULT '', transcript TEXT NOT NULL,
      chapter TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE users (id TEXT PRIMARY KEY, language TEXT NOT NULL DEFAULT 'ko',
      created_at TEXT NOT NULL DEFAULT (datetime('now')));
    INSERT INTO questions VALUES (5, 1, '옛 단계', '旧', '옛 질문 5', '旧質問5');
    INSERT INTO questions VALUES (6, 1, '옛 단계', '旧', '옛 질문 6', '旧質問6');
    INSERT INTO users (id) VALUES ('7777');
    INSERT INTO entries (user_id, question_id, life_stage_id, question_ko, transcript, chapter)
      VALUES ('7777', 5, 1, '옛 질문 5', '옛날 답변', '옛날 챕터');
  `);
  old.close();
  process.env.TURSO_DATABASE_URL = `file:${dbFile}`;
  return () => fs.rmSync(dbFile, { force: true });
});

describe("upgrading a database from the old question bank", () => {
  it("keeps old answers, hides old questions, and asks existing users for fields", async () => {
    const q = await import("@/lib/questions");
    const { getDb } = await import("@/lib/db");

    // Old answer still there for the archive.
    const entries = await q.getAllEntries("7777");
    expect(entries.map((e) => e.transcript)).toEqual(["옛날 답변"]);

    // Answered old question kept (so the answer's reference stays valid) but
    // inactive; unanswered old question removed.
    const db = await getDb();
    const rows = (await db.execute("SELECT id, active FROM questions WHERE id IN (5, 6)")).rows;
    expect(rows.map((r) => [Number(r.id), Number(r.active)])).toEqual([[5, 0]]);

    // Lists and progress only show the new bank.
    const visible = await q.getAllQuestionsWithStatus("7777");
    expect(visible).toHaveLength(50);
    expect(visible.some((x) => x.id === 5)).toBe(false);
    expect((await q.getProgressSummary("7777")).totalAnswered).toBe(0);

    // Existing user hasn't picked fields yet → gets the picker.
    expect(await q.getUserFields("7777")).toBeNull();
  });
});
