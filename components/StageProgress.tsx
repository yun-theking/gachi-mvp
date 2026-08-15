const STAGE_NAMES = [
  "유년기",
  "학창시절",
  "사회초년",
  "커리어",
  "리더십",
  "위기극복",
  "인간관계",
  "가정",
  "가치관",
  "은퇴",
];

interface Props {
  currentStageId: number | null; // null = all 106 answered
  totalAnswered: number;
  totalQuestions: number;
}

export default function StageProgress({
  currentStageId,
  totalAnswered,
  totalQuestions,
}: Props) {
  return (
    <div className="w-full flex flex-col items-center gap-3">
      <div className="flex items-center gap-1.5">
        {STAGE_NAMES.map((name, i) => {
          const stageId = i + 1;
          const done = currentStageId === null || stageId < currentStageId;
          const active = stageId === currentStageId;
          return (
            <div
              key={stageId}
              title={`${stageId}. ${name}`}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                done
                  ? "bg-gold"
                  : active
                  ? "bg-transparent border border-gold dot-pulse"
                  : "bg-transparent border border-text-muted"
              }`}
            />
          );
        })}
      </div>
      <p className="text-[0.65rem] tracking-widest text-text-muted uppercase">
        {currentStageId === null
          ? `모든 생애주기 완료 · ${totalAnswered}/${totalQuestions}`
          : `${currentStageId}. ${STAGE_NAMES[currentStageId - 1]} · ${totalAnswered}/${totalQuestions}`}
      </p>
    </div>
  );
}
