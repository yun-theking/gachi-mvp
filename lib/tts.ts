import { createHash } from "node:crypto";
import { getDb } from "./db";
import type { Lang } from "./auth";

/**
 * Natural-sounding read-aloud via OpenAI text-to-speech (replaces the
 * phone's built-in robotic voice). Voice and model can be changed with
 * TTS_VOICE / TTS_MODEL without touching code.
 */
export const TTS_MODEL = process.env.TTS_MODEL || "gpt-4o-mini-tts";
export const TTS_VOICE = process.env.TTS_VOICE || "coral";
/** Longest text read in one request (questions, follow-ups and reactions are far shorter). */
export const TTS_MAX_CHARS = 600;

/** How to speak: warm, calm and a little slow, like a kind interviewer
 * talking with an older person. */
export const TTS_INSTRUCTIONS: Record<Lang, string> = {
  ko: "Speak natural, standard Korean. Warm, calm and gentle, like a kind interviewer talking with an older person. Speak a little slower than usual and pause briefly between sentences. Do not sound like an announcer.",
  ja: "Speak natural, standard Japanese. Warm, calm and gentle, like a kind interviewer talking with an older person. Speak a little slower than usual and pause briefly between sentences. Do not sound like an announcer.",
};

export function ttsCacheKey(lang: Lang, text: string): string {
  return createHash("sha256")
    .update([TTS_MODEL, TTS_VOICE, TTS_INSTRUCTIONS[lang], lang, text].join("|"))
    .digest("hex");
}

/** Only fixed texts are cached (bank questions); follow-ups and reactions
 * are different every time, so caching them would only grow the table. */
export async function isCacheableText(text: string): Promise<boolean> {
  const db = await getDb();
  const r = await db.execute({
    sql: "SELECT 1 FROM questions WHERE active = 1 AND (question_ko = ? OR question_ja = ?) LIMIT 1",
    args: [text, text],
  });
  return r.rows.length > 0;
}

export async function getCachedAudio(key: string): Promise<Buffer | null> {
  const db = await getDb();
  const row = (await db.execute({ sql: "SELECT audio FROM tts_cache WHERE key = ?", args: [key] }))
    .rows[0] as unknown as { audio: string } | undefined;
  return row ? Buffer.from(row.audio, "base64") : null;
}

export async function saveCachedAudio(key: string, audio: Buffer) {
  const db = await getDb();
  await db.execute({
    sql: "INSERT INTO tts_cache (key, audio) VALUES (?, ?) ON CONFLICT(key) DO NOTHING",
    args: [key, audio.toString("base64")],
  });
}
