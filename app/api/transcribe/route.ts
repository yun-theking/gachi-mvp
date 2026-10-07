import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/apiErrors";
import OpenAI from "openai";
import { LANG_COOKIE, DEFAULT_LANG, isValidLang } from "@/lib/auth";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const langCookie = req.cookies.get(LANG_COOKIE)?.value;
    const lang = isValidLang(langCookie) ? langCookie : DEFAULT_LANG;

    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;

    if (!audioFile) {
      return apiError("INVALID_INPUT", 400);
    }

    // Whisper requires a filename with an extension it recognises
    const file = new File([audioFile], "recording.webm", { type: audioFile.type });

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      language: lang,
    });

    return NextResponse.json({ text: transcription.text });
  } catch (err) {
    console.error("[transcribe]", err);
    return apiError("TRANSCRIBE_FAILED", 500);
  }
}
