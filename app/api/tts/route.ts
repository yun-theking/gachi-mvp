import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { apiError } from "@/lib/apiErrors";
import { USER_COOKIE, LANG_COOKIE, DEFAULT_LANG, isValidLang, type Lang } from "@/lib/auth";
import {
  TTS_MODEL,
  TTS_VOICE,
  TTS_INSTRUCTIONS,
  TTS_MAX_CHARS,
  ttsCacheKey,
  isCacheableText,
  getCachedAudio,
  saveCachedAudio,
} from "@/lib/tts";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function audioResponse(audio: Buffer) {
  return new NextResponse(new Uint8Array(audio), {
    headers: {
      "Content-Type": "audio/mpeg",
      // Same text → same audio; let the phone keep it for a day.
      "Cache-Control": "private, max-age=86400",
    },
  });
}

/** Reads a short text aloud in a natural voice; returns mp3. Logged-in
 * users only, since every new text is a paid OpenAI call. */
export async function POST(req: NextRequest) {
  const userId = req.cookies.get(USER_COOKIE)?.value;
  if (!userId) return apiError("UNAUTHORIZED", 401);
  const langCookie = req.cookies.get(LANG_COOKIE)?.value;

  const { text: raw, lang: bodyLang } = (await req.json()) as { text?: unknown; lang?: unknown };
  const lang: Lang = isValidLang(bodyLang) ? bodyLang : isValidLang(langCookie) ? langCookie : DEFAULT_LANG;
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text || text.length > TTS_MAX_CHARS) return apiError("INVALID_INPUT", 400);

  const key = ttsCacheKey(lang, text);
  const cacheable = await isCacheableText(text);
  if (cacheable) {
    const cached = await getCachedAudio(key);
    if (cached) return audioResponse(cached);
  }

  try {
    const speech = await openai.audio.speech.create({
      model: TTS_MODEL,
      voice: TTS_VOICE,
      input: text,
      instructions: TTS_INSTRUCTIONS[lang],
      response_format: "mp3",
    });
    const audio = Buffer.from(await speech.arrayBuffer());
    if (cacheable) await saveCachedAudio(key, audio);
    return audioResponse(audio);
  } catch (err) {
    console.error("[tts]", err);
    return apiError("GENERATE_FAILED", 500);
  }
}
