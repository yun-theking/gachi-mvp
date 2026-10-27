import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { apiError } from "@/lib/apiErrors";
import {
  getEntryByQuestionId,
  getChapterImage,
  saveChapterImage,
  getUserSettings,
} from "@/lib/questions";
import { USER_COOKIE } from "@/lib/auth";
import { IMAGES_ENABLED, IMAGE_MODEL } from "@/lib/features";
import { illustrationPrompt } from "@/lib/prompts";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Image generation can take a while.
export const maxDuration = 60;

function questionIdFrom(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** The saved illustration for one answer, if there is one. */
export async function GET(req: NextRequest) {
  if (!IMAGES_ENABLED) return apiError("FEATURE_OFF", 404);
  const userId = req.cookies.get(USER_COOKIE)?.value;
  if (!userId) return apiError("UNAUTHORIZED", 401);
  const questionId = questionIdFrom(req.nextUrl.searchParams.get("questionId"));
  if (!questionId) return apiError("INVALID_INPUT", 400);
  return NextResponse.json({ image: await getChapterImage(userId, questionId) });
}

/**
 * Draws one illustration for an answer: the chapter is turned into a scene
 * description (no text in the image, people small or from behind, the
 * person's appearance if they gave one), then an image is generated and
 * saved. Only runs when someone taps the button — each call costs money.
 */
export async function POST(req: NextRequest) {
  if (!IMAGES_ENABLED) return apiError("FEATURE_OFF", 404);
  const userId = req.cookies.get(USER_COOKIE)?.value;
  if (!userId) return apiError("UNAUTHORIZED", 401);
  const { questionId: raw } = (await req.json()) as { questionId?: unknown };
  const questionId = questionIdFrom(raw);
  if (!questionId) return apiError("INVALID_INPUT", 400);

  const entry = await getEntryByQuestionId(userId, questionId);
  if (!entry) return apiError("NOT_FOUND", 404);

  try {
    const { appearance } = await getUserSettings(userId);
    const scene = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: illustrationPrompt(appearance) },
        { role: "user", content: entry.chapter },
      ],
      response_format: { type: "json_object" },
      max_tokens: 400,
      temperature: 0.4,
    });
    const prompt = String(JSON.parse(scene.choices[0].message.content ?? "{}").prompt ?? "").trim();
    if (!prompt) throw new Error("no scene prompt");

    const result = await openai.images.generate({
      model: IMAGE_MODEL,
      prompt,
      size: "1024x1024",
      quality: "low",
      output_format: "webp",
      output_compression: 70,
      n: 1,
    });
    const b64 = result.data?.[0]?.b64_json;
    if (!b64) throw new Error("no image returned");

    const image = `data:image/webp;base64,${b64}`;
    await saveChapterImage(userId, questionId, image);
    return NextResponse.json({ image });
  } catch (err) {
    console.error("[illustrate]", err);
    return apiError("GENERATE_FAILED", 500);
  }
}
