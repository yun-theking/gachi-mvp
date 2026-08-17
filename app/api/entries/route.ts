import { NextRequest, NextResponse } from "next/server";
import { getAllEntries, getProgressSummary, TOTAL_STAGES } from "@/lib/questions";
import { USER_COOKIE } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const userId = req.cookies.get(USER_COOKIE)?.value;
  if (!userId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const entries = await getAllEntries(userId);
  const progress = await getProgressSummary(userId);

  const stageIds = new Set(entries.map((e) => e.life_stage_id));

  return NextResponse.json({
    entries,
    progress: {
      ...progress,
      stagesStarted: stageIds.size,
      totalStages: TOTAL_STAGES,
    },
  });
}
