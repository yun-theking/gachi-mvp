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
  getEntryByQuestionId,
  getSectionProgress,
  getStreakDays,
  toClientQuestion,
  getQuestionNumber,
} from "@/lib/questions";
import { USER_COOKIE, LANG_COOKIE, DEFAULT_LANG, isValidLang, type Lang } from "@/lib/auth";
import {
  chapterPrompt,
  chapterMaxTokens,
  parseChapterResult,
  appendFollowUp,
  MAX_FOLLOW_UPS,
} from "@/lib/prompts";

/** How many recent answers to show the model, and how much of each. */
const RECENT_CONTEXT_COUNT = 6;
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

function sumSeconds(previous: number | null | undefined, now: number | null): number | null {
  if (previous === null || previous === undefined) return now;
  return Number(previous) + (now ?? 0);
}

export async function POST(req: NextRequest) {
  try {
    const userId = req.cookies.get(USER_COOKIE)?.value;
    if (!userId) {
      return apiError("UNAUTHORIZED", 401);
    }
    const langCookie = req.cookies.get(LANG_COOKIE)?.value;
    const lang: Lang = isValidLang(langCookie) ? langCookie : DEFAULT_LANG;

    const { text, questionId, recordingSeconds, timeOnQuestionSeconds, followUp, allowFollowUp } =
      (await req.json()) as {
        text: string;
        questionId?: number;
        recordingSeconds?: unknown;
        timeOnQuestionSeconds?: unknown;
        /** Answering a follow-up: the question asked and how many have been answered so far (1-based). */
        followUp?: { question?: unknown; index?: unknown };
        /** False when re-answering an old question (no follow-ups then). */
        allowFollowUp?: boolean;
      };

    if (!text?.trim()) {
      return apiError("INVALID_INPUT", 400);
    }

    const askedQuestion = questionId ? await getQuestionById(questionId) : undefined;

    // A follow-up answer is added to this question's saved answer and the
    // chapter is rewritten from the combined text.
    const followUpQuestion =
      typeof followUp?.question === "string" && followUp.question.trim() ? followUp.question.trim() : null;
    const followUpIndex =
      typeof followUp?.index === "number" && Number.isInteger(followUp.index) ? followUp.index : 0;
    const previousEntry =
      followUpQuestion && askedQuestion ? await getEntryByQuestionId(userId, askedQuestion.id) : null;
    const fullText = previousEntry
      ? appendFollowUp(lang, previousEntry.transcript, followUpQuestion!, text)
      : text;
    const followUpsLeft =
      allowFollowUp === false || !askedQuestion ? 0 : Math.max(0, MAX_FOLLOW_UPS - followUpIndex);
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
      followUpsLeft,
    });

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
    ];

    messages.push({ role: "user", content: fullText });

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      response_format: { type: "json_object" },
      max_tokens: chapterMaxTokens(fullText),
      // Low temperature: stick to what was said rather than embellish.
      temperature: 0.3,
    });

    const result = parseChapterResult(
      JSON.parse(response.choices[0].message.content ?? "{}"),
      followUpsLeft
    );

    // Was this question already answered? (Then finishing its section now
    // isn't a new milestone.)
    const alreadyAnswered =
      previousEntry !== null ||
      (askedQuestion ? (await getEntryByQuestionId(userId, askedQuestion.id)) !== null : true);

    // Persist this turn now that we have the generated chapter. Store both
    // language versions of the question text regardless of which language
    // the person is using, so switching languages later still shows correctly.
    await saveEntry({
      userId,
      questionId: askedQuestion?.id ?? null,
      lifeStageId,
      questionKo: askedKo,
      questionJa: askedJa,
      transcript: fullText,
      chapter: result.chapter,
      // Follow-ups add to the time already spent on this question.
      recordingSeconds: sumSeconds(previousEntry?.recording_seconds, toSeconds(recordingSeconds)),
      timeOnQuestionSeconds: sumSeconds(
        previousEntry?.time_on_question_seconds,
        toSeconds(timeOnQuestionSeconds)
      ),
    });

    // Did this answer complete its section (every question answered)?
    const sectionNow = (await getSectionProgress(userId)).find((p) => p.stageId === lifeStageId);
    const completedStageId =
      !alreadyAnswered && sectionNow && sectionNow.total > 0 && sectionNow.answered === sectionNow.total
        ? lifeStageId
        : null;

    // Resolve the actual next question. Recompute *after* saving, since saving just
    // consumed one question from the pool and may have advanced the stage.
    const stageAfter = await getCurrentStageId(userId);
    let nextQuestion = null;
    if (stageAfter !== null) {
      const pool = await getRemainingQuestions(userId, stageAfter);
      nextQuestion =
        pool.find((q) => q.id === result.nextQuestionId) ?? pool[0] ?? null;
    }

    return NextResponse.json({
      chapter: result.chapter,
      transcript: fullText,
      reaction: result.reaction,
      followUp: result.followUp,
      bridge: result.bridge,
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
      completedStageId,
      streakDays: await getStreakDays(userId),
    });
  } catch (err) {
    console.error("[generate]", err);
    return apiError("GENERATE_FAILED", 500);
  }
}
