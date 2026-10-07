import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/apiErrors";
import {
  getLastAnsweredEntry,
  getEntryByQuestionId,
  getStagePosition,
  getQuestionById,
} from "@/lib/questions";
import { USER_COOKIE } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const userId = req.cookies.get(USER_COOKIE)?.value;
  if (!userId) {
    return apiError("UNAUTHORIZED", 401);
  }

  // ?questionId=N reopens that specific answered question (from the full
  // question list); without it, falls back to the most recent answer
  // (the existing "이전 질문" button).
  const questionIdParam = req.nextUrl.searchParams.get("questionId");
  const questionId = questionIdParam ? Number(questionIdParam) : null;
  const entry =
    questionId !== null && Number.isInteger(questionId)
      ? await getEntryByQuestionId(userId, questionId)
      : await getLastAnsweredEntry(userId);
  if (!entry || entry.question_id === null) {
    return NextResponse.json({ entry: null, stagePosition: null });
  }

  const [stagePosition, question] = await Promise.all([
    getStagePosition(entry.life_stage_id, entry.question_id),
    getQuestionById(entry.question_id),
  ]);

  return NextResponse.json({
    entry: {
      questionId: entry.question_id,
      lifeStageId: entry.life_stage_id,
      lifeStageKo: question?.life_stage_ko ?? "",
      lifeStageJa: question?.life_stage_ja ?? "",
      questionKo: entry.question_ko,
      questionJa: question?.question_ja ?? "",
      transcript: entry.transcript,
      chapter: entry.chapter,
    },
    stagePosition,
  });
}
