import { NextResponse } from "next/server";
import { pickNextQuestion, getProgressSummary } from "@/lib/questions";

export async function GET() {
  const question = pickNextQuestion();
  const progress = getProgressSummary();

  if (!question) {
    return NextResponse.json({ done: true, nextQuestion: null, progress });
  }

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
  });
}
