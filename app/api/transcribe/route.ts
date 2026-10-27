import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/apiErrors";
import OpenAI from "openai";
import { LANG_COOKIE, USER_COOKIE, DEFAULT_LANG, isValidLang, type Lang } from "@/lib/auth";
import { getQuestionById, getUserFields } from "@/lib/questions";
import { FIELD_SECTIONS } from "@/lib/stages";
import { reviewPrompt, validateReview, type TranscriptReview } from "@/lib/prompts";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Speech-to-text, then a review pass that fixes obviously mis-recognised
 * words and flags doubtful ones. The person confirms or edits the result
 * before any chapter is written, so recognition errors don't end up in the
 * memoir.
 */
export async function POST(req: NextRequest) {
  try {
    const langCookie = req.cookies.get(LANG_COOKIE)?.value;
    const lang: Lang = isValidLang(langCookie) ? langCookie : DEFAULT_LANG;
    const userId = req.cookies.get(USER_COOKIE)?.value;

    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;
    if (!audioFile) {
      return apiError("INVALID_INPUT", 400);
    }

    // What the person is answering and their field: given to speech
    // recognition as a hint (so job terms like 약사 are recognised more
    // reliably) and to the review pass as context.
    const questionId = Number(formData.get("questionId"));
    const question = Number.isInteger(questionId) && questionId > 0
      ? await getQuestionById(questionId)
      : undefined;
    const questionText = question ? (lang === "ja" ? question.question_ja : question.question_ko) : "";
    const fields = userId ? ((await getUserFields(userId)) ?? []) : [];
    const fieldName = FIELD_SECTIONS.filter((f) => fields.includes(f.fieldCode!))
      .map((f) => f.name[lang])
      .join(", ");

    // Whisper requires a filename with an extension it recognises
    const file = new File([audioFile], "recording.webm", { type: audioFile.type });

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      language: lang,
      prompt: [questionText, fieldName].filter(Boolean).join(" ").slice(0, 400) || undefined,
    });
    const text = transcription.text;

    return NextResponse.json({ text, review: await reviewTranscript(lang, text, questionText, fieldName) });
  } catch (err) {
    console.error("[transcribe]", err);
    return apiError("TRANSCRIBE_FAILED", 500);
  }
}

/** Best-effort: if the review fails, the person just sees the raw text. */
async function reviewTranscript(
  lang: Lang,
  text: string,
  question: string,
  field: string
): Promise<TranscriptReview> {
  const fallback: TranscriptReview = { text, corrections: [], uncertain: [] };
  if (text.trim().length < 2) return fallback;
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: reviewPrompt(lang, question, field) },
        { role: "user", content: text },
      ],
      response_format: { type: "json_object" },
      max_tokens: Math.min(4000, 300 + Math.ceil(text.length * 1.5)),
      temperature: 0,
    });
    return validateReview(text, JSON.parse(response.choices[0].message.content ?? "{}"));
  } catch (err) {
    console.error("[transcribe/review]", err);
    return fallback;
  }
}
