interface Props {
  onPrevious: () => void;
  onSkip: () => void;
  previousDisabled?: boolean;
  skipDisabled?: boolean;
}

export default function QuestionActionsRow({
  onPrevious,
  onSkip,
  previousDisabled,
  skipDisabled,
}: Props) {
  return (
    <div className="w-full max-w-xl grid grid-cols-2 gap-3">
      <button
        onClick={onPrevious}
        disabled={previousDisabled}
        className="py-4 rounded-2xl border border-border text-text font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface2 transition-colors"
      >
        이전 질문
      </button>
      <button
        onClick={onSkip}
        disabled={skipDisabled}
        className="py-4 rounded-2xl bg-surface2 text-text-dim font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-border transition-colors"
      >
        건너뛰기
      </button>
    </div>
  );
}
