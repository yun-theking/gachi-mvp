import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/apiErrors";
import OpenAI from "openai";
import {
  getQuestionById,
  getCurrentStageId,
  getRemainingQuestions,
  saveEntry,
  getProgressSummary,
  getStagePosition,
  getRecentEntries,
  toClientQuestion,
  getQuestionNumber,
} from "@/lib/questions";
import { USER_COOKIE, LANG_COOKIE, DEFAULT_LANG, isValidLang, type Lang } from "@/lib/auth";
import { chapterPrompt, chapterMaxTokens } from "@/lib/prompts";

/** How many recent answers to show the model, and how much of each. */
const RECENT_CONTEXT_COUNT = 4;
const RECENT_ANSWER_MAX_CHARS = 300;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/** Stand-in "question" for an answer not tied to a bank question. */
const NO_ANSWER_TEXT: Record<Lang, string> = { ko: "(자유 답변)", ja: "（自由回答）" };

/** Client-reported durations: whole seconds within a sane range, else null. */
function toSeconds(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return null;
  return Math.min(Math.round(v), 24 * 60 * 60);
}

export async function POST(req: NextRequest) {
  try {
    const userId = req.cookies.get(USER_COOKIE)?.value;
    if (!userId) {
      return apiError("UNAUTHORIZED", 401);
    }
    const langCookie = req.cookies.get(LANG_COOKIE)?.value;
    const lang: Lang = isValidLang(langCookie) ? langCookie : DEFAULT_LANG;

    const { text, questionId, recordingSeconds, timeOnQuestionSeconds } = (await req.json()) as {
      text: string;
      questionId?: number;
      recordingSeconds?: unknown;
      timeOnQuestionSeconds?: unknown;
    };

    if (!text?.trim()) {
      return apiError("INVALID_INPUT", 400);
    }

    const askedQuestion = questionId ? await getQuestionById(questionId) : undefined;
    const lifeStageId =
      askedQuestion?.life_stage_id ?? (await getCurrentStageId(userId)) ?? 1;

    const askedKo = askedQuestion?.question_ko ?? NO_ANSWER_TEXT[lang];
    const askedJa = askedQuestion?.question_ja ?? NO_ANSWER_TEXT[lang];
    const askedText = lang === "ja" ? askedJa : askedKo;

    const stageBefore = await getCurrentStageId(userId);

    // Candidates for the *next* question: remaining questions in the same stage,
    // excluding the one the user just answered. The model may only pick from this list —
    // it never invents question text itself.
    const stageCandidates = (await getRemainingQuestions(userId, lifeStageId)).filter(
      (q) => q.id !== questionId
    );
    const candidateList = stageCandidates
      .map((q) => `- id:${q.id} "${lang === "ja" ? q.question_ja : q.question_ko}"`)
      .join("\n");

    // Recent conversation flow, read from the DB (not sent by the browser),
    // so it survives a page refresh. Excludes the question being answered
    // now, which matters when re-answering an older question.
    const recent = (await getRecentEntries(userId, RECENT_CONTEXT_COUNT + 1))
      .filter((e) => e.question_id !== (questionId ?? null))
      .slice(0, RECENT_CONTEXT_COUNT)
      .reverse();
    const recentAnswers = recent
      .map((e) => {
        const q = lang === "ja" && e.question_ja ? e.question_ja : e.question_ko;
        const a = e.transcript.length > RECENT_ANSWER_MAX_CHARS
          ? e.transcript.slice(0, RECENT_ANSWER_MAX_CHARS) + "…"
          : e.transcript;
        return `- Q: ${q}\n  A: ${a}`;
      })
      .join("\n");

    const systemPrompt = chapterPrompt(lang, {
      asked: askedText,
      recent: recentAnswers,
      candidates: candidateList,
    });

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
    ];

    messages.push({ role: "user", content: text });

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      response_format: { type: "json_object" },
      max_tokens: chapterMaxTokens(text),
      // Low temperature: stick to what was said rather than embellish.
      temperature: 0.3,
    });

    const raw = response.choices[0].message.content ?? "{}";
    const parsed = JSON.parse(raw) as {
      chapter: string;
      next_question_id: number | null;
    };

    // Persist this turn now that we have the generated chapter. Store both
    // language versions of the question text regardless of which language
    // the person is using, so switching languages later still shows correctly.
    await saveEntry({
      userId,
      questionId: askedQuestion?.id ?? null,
      lifeStageId,
      questionKo: askedKo,
      questionJa: askedJa,
      transcript: text,
      chapter: parsed.chapter,
      recordingSeconds: toSeconds(recordingSeconds),
      timeOnQuestionSeconds: toSeconds(timeOnQuestionSeconds),
    });

    // Resolve the actual next question. Recompute *after* saving, since saving just
    // consumed one question from the pool and may have advanced the stage.
    const stageAfter = await getCurrentStageId(userId);
    let nextQuestion = null;
    if (stageAfter !== null) {
      const pool = await getRemainingQuestions(userId, stageAfter);
      nextQuestion =
        pool.find((q) => q.id === parsed.next_question_id) ?? pool[0] ?? null;
    }

    return NextResponse.json({
      chapter: parsed.chapter,
      nextQuestion: nextQuestion
        ? toClientQuestion(nextQuestion, await getQuestionNumber(userId, nextQuestion.id))
        : null,
      stagePosition: nextQuestion
        ? await getStagePosition(nextQuestion.life_stage_id, nextQuestion.id)
        : null,
      stageAdvanced:
        stageBefore !== null && stageAfter !== null && stageAfter !== stageBefore,
      done: stageAfter === null,
      progress: await getProgressSummary(userId),
    });
  } catch (err) {
    console.error("[generate]", err);
    return apiError("GENERATE_FAILED", 500);
  }
}
