import { IconMic } from "./icons";
import { useLanguage } from "./LanguageProvider";

export type Step = "idle" | "recording" | "transcribing" | "generating" | "done" | "error";

interface Props {
  step: Step;
  recordingSeconds: number;
  statusText: string;
  actionLabel: string;
  onClick: () => void;
  disabled?: boolean;
}

const fmt = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export default function RecordButton({
  step,
  recordingSeconds,
  statusText,
  actionLabel,
  onClick,
  disabled,
}: Props) {
  const { dict: t } = useLanguage();
  const busy = step === "transcribing" || step === "generating";
  const recording = step === "recording";

  return (
    <div className="w-full max-w-xl flex flex-col items-center gap-4 py-4">
      <p className="text-sm text-text-dim text-center leading-relaxed">
        {step === "idle" || step === "done" || step === "error"
          ? t.recordIdle.split("\n").map((line, i) => (
              <span key={i}>
                {line}
                <br />
              </span>
            ))
          : statusText}
      </p>

      {/* Waveform while recording */}
      <div
        className={`flex items-end gap-1 h-8 transition-opacity duration-300 ${
          recording ? "opacity-100" : "opacity-0"
        }`}
      >
        {Array.from({ length: 12 }).map((_, i) => (
          <span
            key={i}
            className="wave-bar w-[3px] rounded bg-accent"
            style={{ animationDelay: `${(i % 6) * 0.08}s`, height: 8 }}
          />
        ))}
      </div>

      <button
        onClick={onClick}
        disabled={disabled || busy}
        className={`w-28 h-28 rounded-full flex items-center justify-center shadow-lg transition-all duration-150
          ${
            recording
              ? "bg-gradient-to-br from-danger to-[#8f2e1c] recording-pulse"
              : busy
              ? "bg-surface2 cursor-not-allowed"
              : "bg-gradient-to-br from-accent to-accent-dark hover:scale-105 active:scale-95"
          }`}
      >
        {recording ? (
          <span className="w-6 h-6 rounded-sm bg-white/90" />
        ) : busy ? (
          <span className="text-3xl text-text-dim animate-spin">⏳</span>
        ) : (
          <IconMic className="w-9 h-9 text-white" />
        )}
      </button>

      <p className="font-bold text-text text-lg">
        {recording ? t.recordStop : busy ? statusText : actionLabel}
      </p>

      <div
        className={`font-mono text-xl font-light tracking-wider text-accent-dark transition-opacity duration-300 ${
          recording ? "opacity-100" : "opacity-0"
        }`}
      >
        {fmt(recordingSeconds)}
      </div>

      {step === "error" && <p className="text-sm text-danger text-center">{statusText}</p>}
    </div>
  );
}
