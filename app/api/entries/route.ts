import { NextResponse } from "next/server";
import { getAllEntries, getProgressSummary, TOTAL_STAGES } from "@/lib/questions";

export async function GET() {
  const entries = await getAllEntries();
  const progress = await getProgressSummary();

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
