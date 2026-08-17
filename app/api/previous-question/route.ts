import { NextRequest, NextResponse } from "next/server";
import { getLastAnsweredEntry, getStagePosition, getQuestionById } from "@/lib/questions";
import { USER_COOKIE } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const userId = req.cookies.get(USER_COOKIE)?.value;
  if (!userId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const entry = await getLastAnsweredEntry(userId);
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
