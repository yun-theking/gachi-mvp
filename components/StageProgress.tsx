const STAGE_NAMES_SHORT: Record<number, string> = {
  1: "유년기",
  2: "학창시절",
  3: "사회초년",
  4: "커리어",
  5: "리더십",
  6: "위기극복",
  7: "인간관계",
  8: "가정",
  9: "가치관",
  10: "은퇴",
};

interface Props {
  currentStageId: number | null; // null = all done
  stagePosition: { position: number; total: number } | null;
}

export default function StageProgress({ currentStageId, stagePosition }: Props) {
  if (currentStageId === null || !stagePosition) {
    return (
      <div className="w-full flex flex-col gap-2">
        <p className="text-xs text-text-dim">모든 생애주기를 완료했어요</p>
      </div>
    );
  }

  const { position, total } = stagePosition;
  const pct = total > 0 ? Math.round((position / total) * 100) : 0;

  return (
    <div className="w-full flex flex-col gap-2">
      <p className="text-xs text-text-dim">
        {total}개 질문 중 {position}번째 · {STAGE_NAMES_SHORT[currentStageId]}
      </p>
      <div className="w-full h-1.5 rounded-full bg-surface2 overflow-hidden">
        <div
          className="h-full rounded-full bg-accent transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
