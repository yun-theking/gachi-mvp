import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/apiErrors";
import {
  skipQuestion,
  getCurrentStageId,
  getRemainingQuestions,
  getProgressSummary,
  getStagePosition,
} from "@/lib/questions";
import { USER_COOKIE } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const userId = req.cookies.get(USER_COOKIE)?.value;
  if (!userId) {
    return apiError("UNAUTHORIZED", 401);
  }

  const { questionId } = (await req.json()) as { questionId?: number };
  if (!questionId) {
    return apiError("INVALID_INPUT", 400);
  }

  const stageBefore = await getCurrentStageId(userId);
  await skipQuestion(userId, questionId);
  const stageAfter = await getCurrentStageId(userId);

  let nextQuestion = null;
  if (stageAfter !== null) {
    const pool = await getRemainingQuestions(userId, stageAfter);
    nextQuestion = pool[0] ?? null;
  }

  return NextResponse.json({
    nextQuestion: nextQuestion
      ? {
          id: nextQuestion.id,
          life_stage_id: nextQuestion.life_stage_id,
          life_stage_ko: nextQuestion.life_stage_ko,
          life_stage_ja: nextQuestion.life_stage_ja,
          question_ko: nextQuestion.question_ko,
          question_ja: nextQuestion.question_ja,
        }
      : null,
    stagePosition: nextQuestion
      ? await getStagePosition(nextQuestion.life_stage_id, nextQuestion.id)
      : null,
    stageAdvanced:
      stageBefore !== null && stageAfter !== null && stageAfter !== stageBefore,
    done: stageAfter === null,
    progress: await getProgressSummary(userId),
  });
}
