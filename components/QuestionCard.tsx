export interface BankQuestion {
  id: number;
  life_stage_id: number;
  life_stage_ko: string;
  life_stage_ja: string;
  question_ko: string;
  question_ja: string;
}

interface Props {
  question: BankQuestion | null;
  showJapanese: boolean;
  onToggleJapanese: () => void;
}

export default function QuestionCard({
  question,
  showJapanese,
  onToggleJapanese,
}: Props) {
  if (!question) {
    return (
      <div className="w-full max-w-xl bg-surface border border-border rounded-2xl p-8 text-center">
        <p className="font-serif text-gold-light text-lg mb-2">
          106개 질문을 모두 마쳤습니다
        </p>
        <p className="text-text-dim text-sm">
          &ldquo;내 회고록&rdquo; 메뉴에서 지금까지 쌓인 이야기를 확인해보세요.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-xl bg-surface border border-border rounded-2xl p-7 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[0.65rem] tracking-widest uppercase text-gold-dim">
          {question.life_stage_ko}
        </span>
        <button
          onClick={onToggleJapanese}
          className="text-[0.65rem] tracking-widest uppercase text-text-muted hover:text-gold transition-colors"
        >
          {showJapanese ? "한국어만" : "日本語"}
        </button>
      </div>
      <p className="font-serif text-text text-lg leading-relaxed">
        {question.question_ko}
      </p>
      {showJapanese && (
        <p className="text-text-dim text-sm leading-relaxed border-t border-border pt-3">
          {question.question_ja}
        </p>
      )}
    </div>
  );
}
