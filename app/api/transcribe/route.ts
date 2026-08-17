import { NextRequest, NextResponse } from "next/server";
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
      return NextResponse.json({ error: "오디오 파일이 없습니다." }, { status: 400 });
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
    return NextResponse.json(
      { error: "음성 변환 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
