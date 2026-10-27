import { IconMic } from "./icons";
import { useLanguage } from "./LanguageProvider";

export type Step =
  | "idle"
  | "recording"
  | "transcribing"
  | "review" // checking what was heard, before the chapter is written
  | "generating"
  | "done"
  | "error";

interface Props {
  step: Step;
  recordingSeconds: number;
  statusText: string;
  actionLabel: string;
  onClick: () => void;
  disabled?: boolean;
}

const RING_R = 74;
const RING_C = 2 * Math.PI * RING_R;
// Resting swoosh: a short arc ending in a dot at the top right, like the logo.
const RESTING_FILL = 0.22;
const MAX_SECONDS = 600;

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
  const ringFill = recording
    ? Math.min(recordingSeconds / MAX_SECONDS, 1)
    : busy
    ? 0
    : RESTING_FILL;
  // Dot at the end of the resting arc (the ring starts at 12 o'clock).
  const angle = RESTING_FILL * 2 * Math.PI - Math.PI / 2;
  const dotStyle = {
    left: `calc(50% + ${Math.cos(angle) * (RING_R / 160) * 100}% - 7px)`,
    top: `calc(50% + ${Math.sin(angle) * (RING_R / 160) * 100}% - 7px)`,
  };

  return (
    <div className="w-full max-w-xl flex flex-col items-center gap-4 py-4">
      <p className="text-base text-center leading-relaxed text-text-dim">
        {step === "error" ? (
          <span className="text-danger">{statusText}</span>
        ) : step === "idle" || step === "done" ? (
          t.recordIdle.split("\n").map((line, i) => (
            <span key={i}>
              {line}
              <br />
            </span>
          ))
        ) : (
          statusText
        )}
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
            className="wave-bar w-1 rounded bg-accent-light"
            style={{ animationDelay: `${(i % 6) * 0.08}s`, height: 8 }}
          />
        ))}
      </div>

      {/* The ring echoes the logo's orange swoosh. While recording it fills up
          toward the 10-minute limit, so the time left is visible at a glance. */}
      <div className="relative w-40 h-40 flex items-center justify-center">
        <svg viewBox="0 0 160 160" className="absolute inset-0 w-full h-full -rotate-90" aria-hidden="true">
          <circle cx="80" cy="80" r={RING_R} fill="none" stroke="#F2EFE9" strokeWidth="6" />
          <circle
            cx="80"
            cy="80"
            r={RING_R}
            fill="none"
            stroke="#D9680F"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={RING_C}
            strokeDashoffset={RING_C * (1 - ringFill)}
            className="transition-[stroke-dashoffset] duration-1000 ease-linear"
          />
        </svg>
        {!recording && !busy && (
          <span
            aria-hidden="true"
            className="absolute w-3.5 h-3.5 rounded-full bg-accent-light"
            style={dotStyle}
          />
        )}
        <button
          onClick={onClick}
          disabled={disabled || busy}
          aria-label={recording ? t.recordStop : actionLabel}
          className={`relative w-32 h-32 rounded-full flex items-center justify-center transition-transform duration-150 disabled:cursor-not-allowed ${
            recording
              ? "bg-danger recording-pulse"
              : busy
              ? "bg-surface2"
              : disabled
              ? "bg-surface2"
              : "bg-accent shadow-[0_6px_20px_rgba(170,74,8,0.28)] hover:scale-[1.03] active:scale-95"
          }`}
        >
          {recording ? (
            <span className="w-8 h-8 rounded-md bg-white" />
          ) : busy ? (
            <span className="spin-ring w-12 h-12 rounded-full border-4 border-border border-t-accent" />
          ) : (
            <IconMic className={`w-11 h-11 ${disabled ? "text-text-muted" : "text-white"}`} />
          )}
        </button>
      </div>

      <p className="font-bold text-text text-xl">
        {recording ? t.recordStop : busy ? statusText : actionLabel}
      </p>

      <div
        className={`text-2xl font-semibold tabular-nums text-accent-dark transition-opacity duration-300 ${
          recording ? "opacity-100" : "opacity-0"
        }`}
      >
        {fmt(recordingSeconds)}
      </div>
    </div>
  );
}
