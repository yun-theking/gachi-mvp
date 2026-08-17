interface Props {
  label?: string;
  questionKo?: string;
  transcript?: string;
  chapter: string;
  meta?: string;
}

export default function ChapterPanel({
  label = "회고록 챕터",
  questionKo,
  transcript,
  chapter,
  meta,
}: Props) {
  return (
    <div className="panel-enter w-full max-w-xl bg-surface border border-border rounded-2xl p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <span className="text-[0.65rem] tracking-widest uppercase text-accent-dark flex items-center gap-2 before:content-[''] before:block before:w-5 before:h-px before:bg-accent-dark">
          {label}
        </span>
        {meta && <span className="text-[0.65rem] text-text-muted">{meta}</span>}
      </div>

      {questionKo && (
        <p className="text-xs text-accent-dark italic leading-relaxed">
          Q. {questionKo}
        </p>
      )}

      {transcript && (
        <p className="text-sm text-text-dim italic leading-relaxed border-l-2 border-border pl-3">
          {transcript}
        </p>
      )}

      <p className="font-serif text-text text-[1.02rem] leading-8 whitespace-pre-wrap">
        {chapter}
      </p>
    </div>
  );
}
