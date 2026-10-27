import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/apiErrors";
import {
  pickNextQuestion,
  getProgressSummary,
  getStagePosition,
  getUserFields,
  shouldShowOnboarding,
  getStreakDays,
  toClientQuestion,
  getQuestionNumber,
} from "@/lib/questions";
import { USER_COOKIE } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const userId = req.cookies.get(USER_COOKIE)?.value;
  if (!userId) {
    return apiError("UNAUTHORIZED", 401);
  }

  // Accounts that predate the field picker (or skipped it by closing the
  // tab) get sent to it before starting.
  const needsFields = (await getUserFields(userId)) === null;
  const showOnboarding = await shouldShowOnboarding(userId);
  const streakDays = await getStreakDays(userId);

  const question = await pickNextQuestion(userId);
  const progress = await getProgressSummary(userId);

  if (!question) {
    return NextResponse.json({ done: true, nextQuestion: null, progress, stagePosition: null, needsFields, showOnboarding, streakDays });
  }

  const stagePosition = await getStagePosition(question.life_stage_id, question.id);

  return NextResponse.json({
    done: false,
    nextQuestion: toClientQuestion(question, await getQuestionNumber(userId, question.id)),
    progress,
    stagePosition,
    needsFields,
    showOnboarding,
    streakDays,
  });
}
