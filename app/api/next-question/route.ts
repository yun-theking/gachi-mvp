import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/apiErrors";
import {
  pickNextQuestion,
  getProgressSummary,
  getStagePosition,
  getUserFields,
  shouldShowOnboarding,
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

  const question = await pickNextQuestion(userId);
  const progress = await getProgressSummary(userId);

  if (!question) {
    return NextResponse.json({ done: true, nextQuestion: null, progress, stagePosition: null, needsFields, showOnboarding });
  }

  const stagePosition = await getStagePosition(question.life_stage_id, question.id);

  return NextResponse.json({
    done: false,
    nextQuestion: {
      id: question.id,
      life_stage_id: question.life_stage_id,
      life_stage_ko: question.life_stage_ko,
      life_stage_ja: question.life_stage_ja,
      question_ko: question.question_ko,
      question_ja: question.question_ja,
    },
    progress,
    stagePosition,
    needsFields,
    showOnboarding,
  });
}
