import { NextRequest, NextResponse } from "next/server";
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
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { questionId } = (await req.json()) as { questionId?: number };
  if (!questionId) {
    return NextResponse.json({ error: "questionId가 없습니다." }, { status: 400 });
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
