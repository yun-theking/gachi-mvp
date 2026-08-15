export type Step =
  | "idle"
  | "recording"
  | "transcribing"
  | "generating"
  | "done"
  | "error";

interface Props {
  step: Step;
  recordingSeconds: number;
  statusText: string;
  onClick: () => void;
  disabled?: boolean;
}

const fmt = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(
    2,
    "0"
  )}`;

export default function RecordButton({
  step,
  recordingSeconds,
  statusText,
  onClick,
  disabled,
}: Props) {
  const busy = step === "transcribing" || step === "generating";
  const recording = step === "recording";

  return (
    <div className="bg-surface border border-border rounded-3xl p-10 flex flex-col items-center gap-6 w-full max-w-xl relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-60 h-px bg-gradient-to-r from-transparent via-gold-dim to-transparent" />

      {/* Waveform */}
      <div
        className={`flex items-end gap-1 h-9 transition-opacity duration-300 ${
          recording ? "opacity-100" : "opacity-0"
        }`}
      >
        {Array.from({ length: 12 }).map((_, i) => (
          <span
            key={i}
            className="wave-bar w-[3px] rounded bg-gold"
            style={{ animationDelay: `${(i % 6) * 0.08}s`, height: 8 }}
          />
        ))}
      </div>

      <button
        onClick={onClick}
        disabled={disabled || busy}
        className={`w-24 h-24 rounded-full flex flex-col items-center justify-center gap-1 shadow-lg transition-all duration-150
          ${
            recording
              ? "bg-gradient-to-br from-danger to-red-800 recording-pulse"
              : busy
              ? "bg-gradient-to-br from-[#3a3530] to-[#2a2520] cursor-not-allowed"
              : "bg-gradient-to-br from-gold to-[#a07840] hover:scale-105 active:scale-95"
          }`}
      >
        {recording ? (
          <>
            <span className="text-2xl leading-none">⏹</span>
            <span className="text-[0.6rem] tracking-widest uppercase text-white/80">
              중지
            </span>
          </>
        ) : step === "transcribing" ? (
          <>
            <span className="text-2xl leading-none animate-spin">⏳</span>
            <span className="text-[0.6rem] tracking-widest uppercase text-white/60">
              변환중
            </span>
          </>
        ) : step === "generating" ? (
          <>
            <span className="text-2xl leading-none animate-pulse">✍️</span>
            <span className="text-[0.6rem] tracking-widest uppercase text-white/60">
              작성중
            </span>
          </>
        ) : (
          <>
            <span className="text-3xl leading-none">🎙️</span>
            <span className="text-[0.6rem] tracking-widest uppercase text-white/80">
              답변
            </span>
          </>
        )}
      </button>

      <div
        className={`font-mono text-2xl font-light tracking-wider text-gold-light transition-opacity duration-300 ${
          recording ? "opacity-100" : "opacity-0"
        }`}
      >
        {fmt(recordingSeconds)}
      </div>

      <p
        className={`text-sm text-center min-h-[18px] ${
          step === "error"
            ? "text-danger"
            : recording
            ? "text-danger"
            : busy
            ? "text-gold"
            : "text-text-dim"
        }`}
      >
        {statusText}
      </p>
    </div>
  );
}
