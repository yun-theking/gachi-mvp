"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import RecordButton, { type Step } from "@/components/RecordButton";
import QuestionCard, { type BankQuestion } from "@/components/QuestionCard";
import ChapterPanel from "@/components/ChapterPanel";
import StageProgress from "@/components/StageProgress";
import QuestionActionsRow from "@/components/QuestionActionsRow";
import { IconChevronLeft } from "@/components/icons";
import { useLanguage } from "@/components/LanguageProvider";

const MAX_RECORDING_SECONDS = 600; // 10 minutes
const WARNING_AT_SECONDS = 570; // warn 30s before auto-stop

interface HistoryEntry {
  role: "user" | "assistant";
  content: string;
}

interface Progress {
  totalAnswered: number;
  totalQuestions: number;
}

interface StagePos {
  position: number;
  total: number;
}

interface PreviousEntry {
  questionId: number;
  lifeStageId: number;
  lifeStageKo: string;
  lifeStageJa: string;
  questionKo: string;
  questionJa: string;
  transcript: string;
  chapter: string;
}

type ErrorKind = "mic" | "network" | "silence" | null;

export default function Home() {
  const { lang, dict: t } = useLanguage();

  const [step, setStep] = useState<Step>("idle");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [error, setError] = useState("");
  const [errorKind, setErrorKind] = useState<ErrorKind>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const [currentQuestion, setCurrentQuestion] = useState<BankQuestion | null>(null);
  const [currentStageId, setCurrentStageId] = useState<number | null>(1);
  const [stagePosition, setStagePosition] = useState<StagePos | null>(null);
  const [progress, setProgress] = useState<Progress>({ totalAnswered: 0, totalQuestions: 0 });
  const [initialLoading, setInitialLoading] = useState(true);

  const [lastTranscript, setLastTranscript] = useState("");
  const [lastChapter, setLastChapter] = useState("");
  const [noteText, setNoteText] = useState("");

  // "이전 질문" redo mode
  const [mode, setMode] = useState<"normal" | "redo">("normal");
  const [previousEntry, setPreviousEntry] = useState<PreviousEntry | null>(null);
  const [loadingPrevious, setLoadingPrevious] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Kept across a failed send so "다시 보내기" can retry without re-recording.
  const pendingBlobRef = useRef<Blob | null>(null);
  const pendingTextRef = useRef<string | null>(null);
  const autoStopRef = useRef<((auto?: boolean) => void) | null>(null);

  const loadNextQuestion = useCallback(async () => {
    const res = await fetch("/api/next-question");
    const data = await res.json();
    setCurrentQuestion(data.nextQuestion);
    setCurrentStageId(data.nextQuestion?.life_stage_id ?? null);
    setStagePosition(data.stagePosition);
    setProgress(data.progress);
    setInitialLoading(false);
  }, []);

  useEffect(() => {
    loadNextQuestion();
  }, [loadNextQuestion]);

  const activeQuestionId =
    mode === "redo" ? previousEntry?.questionId : currentQuestion?.id;

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
        // Bounds file size predictably: ~4.8MB for a full 10-minute take,
        // safely under Whisper's 25MB limit.
        audioBitsPerSecond: 64000,
      });

      chunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;
      pendingBlobRef.current = null;
      pendingTextRef.current = null;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.start(100);
      setStep("recording");
      setRecordingSeconds(0);
      setError("");
      setErrorKind(null);
      setNoteText("");

      timerRef.current = setInterval(() => {
        setRecordingSeconds((s) => {
          const next = s + 1;
          if (next >= MAX_RECORDING_SECONDS) {
            autoStopRef.current?.(true);
          }
          return next;
        });
      }, 1000);
    } catch {
      setError(t.micDenied);
      setErrorKind("mic");
      setStep("error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  const stopRecording = useCallback(
    (auto = false) => {
      const mediaRecorder = mediaRecorderRef.current;
      if (!mediaRecorder) return;

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        mediaRecorder.stream.getTracks().forEach((track) => track.stop());
        if (auto) setNoteText(t.recordingAutoStopped);
        await processAudio(blob);
      };

      mediaRecorder.stop();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [activeQuestionId, history, mode, t]
  );

  useEffect(() => {
    autoStopRef.current = stopRecording;
  }, [stopRecording]);

  const transcribeAudio = async (blob: Blob): Promise<string> => {
    const formData = new FormData();
    formData.append("audio", blob, "recording.webm");
    const res = await fetch("/api/transcribe", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "STT failed");
    return data.text as string;
  };

  const generateChapter = async (text: string) => {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        questionId: activeQuestionId,
        history: mode === "redo" ? [] : history,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || t.loginErrorGeneric);

    setLastChapter(data.chapter);

    if (mode === "redo") {
      // Redoing an old question doesn't move the current pointer — the API
      // returns the same still-current question, so just resync state and
      // hop back to the normal flow.
      setNoteText(t.redoSavedNote);
      setMode("normal");
      setPreviousEntry(null);
    } else if (data.stageAdvanced) {
      setNoteText(t.stageAdvancedNote);
    }

    setCurrentQuestion(data.nextQuestion);
    setCurrentStageId(data.nextQuestion?.life_stage_id ?? null);
    setStagePosition(data.stagePosition);
    setProgress(data.progress);

    setHistory((prev) => [
      ...prev,
      { role: "user", content: text },
      { role: "assistant", content: JSON.stringify(data) },
    ]);
  };

  const processAudio = async (blob: Blob) => {
    pendingBlobRef.current = blob;
    pendingTextRef.current = null;
    setErrorKind(null);
    setStep("transcribing");

    let text: string;
    try {
      text = await transcribeAudio(blob);
    } catch {
      // Audio is kept in pendingBlobRef — "다시 보내기" retries this exact
      // recording without asking the person to talk again.
      setError(t.networkErrorMessage);
      setErrorKind("network");
      setStep("error");
      return;
    }

    if (!text || text.trim().length < 2) {
      pendingBlobRef.current = null; // nothing useful to resend
      setError(t.silenceMessage);
      setErrorKind("silence");
      setStep("error");
      return;
    }

    pendingTextRef.current = text;
    setLastTranscript(text);
    setStep("generating");

    try {
      await generateChapter(text);
    } catch {
      setError(t.networkErrorMessage);
      setErrorKind("network");
      setStep("error");
      return;
    }

    pendingBlobRef.current = null;
    pendingTextRef.current = null;
    setStep("done");
  };

  const resend = async () => {
    setError("");
    if (pendingTextRef.current) {
      // Already transcribed — resume from the generate step only.
      setStep("generating");
      try {
        await generateChapter(pendingTextRef.current);
        pendingBlobRef.current = null;
        pendingTextRef.current = null;
        setStep("done");
      } catch {
        setError(t.networkErrorMessage);
        setErrorKind("network");
        setStep("error");
      }
    } else if (pendingBlobRef.current) {
      await processAudio(pendingBlobRef.current);
    }
  };

  const discardAndRerecord = () => {
    pendingBlobRef.current = null;
    pendingTextRef.current = null;
    setErrorKind(null);
    setError("");
    setStep("idle");
  };

  const handlePrevious = async () => {
    setLoadingPrevious(true);
    setNoteText("");
    try {
      const res = await fetch("/api/previous-question");
      const data = await res.json();
      if (!data.entry) {
        setNoteText(t.noPreviousNote);
        return;
      }
      setPreviousEntry(data.entry);
      setMode("redo");
      setStep("idle");
    } finally {
      setLoadingPrevious(false);
    }
  };

  const cancelRedo = () => {
    setMode("normal");
    setPreviousEntry(null);
    setStep("idle");
  };

  const handleSkip = async () => {
    if (!currentQuestion) return;
    setNoteText("");
    const res = await fetch("/api/skip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId: currentQuestion.id }),
    });
    const data = await res.json();
    if (!res.ok) return;

    setCurrentQuestion(data.nextQuestion);
    setCurrentStageId(data.nextQuestion?.life_stage_id ?? null);
    setStagePosition(data.stagePosition);
    setProgress(data.progress);
    setNoteText(t.skippedNote);
  };

  const busy = step === "transcribing" || step === "generating";
  const showResendUI = step === "error" && errorKind === "network";

  const statusText = (() => {
    if (step === "error") return error;
    if (step === "recording") {
      return recordingSeconds >= WARNING_AT_SECONDS ? t.recordingTimeWarning : t.recording;
    }
    if (step === "transcribing") return t.transcribing;
    if (step === "generating") return t.generating;
    return "";
  })();

  const micRetryActive = step === "error" && errorKind === "mic";

  const redoQuestion: BankQuestion | null = previousEntry
    ? {
        id: previousEntry.questionId,
        life_stage_id: previousEntry.lifeStageId,
        life_stage_ko: previousEntry.lifeStageKo,
        life_stage_ja: previousEntry.lifeStageJa,
        question_ko: previousEntry.questionKo,
        question_ja: previousEntry.questionJa,
      }
    : null;

  const previousQuestionText = previousEntry
    ? lang === "ja"
      ? previousEntry.questionJa
      : previousEntry.questionKo
    : "";

  const ResendBlock = (
    <div className="w-full max-w-xl flex flex-col items-center gap-3 py-4">
      <p className="text-sm text-danger text-center">{error}</p>
      <button
        onClick={resend}
        className="w-full py-4 rounded-2xl bg-accent text-bg font-semibold text-lg tracking-wide"
      >
        {t.resend}
      </button>
      <button
        onClick={discardAndRerecord}
        className="text-xs text-text-dim underline hover:text-accent transition-colors"
      >
        {t.rerecordInstead}
      </button>
    </div>
  );

  return (
    <main className="min-h-screen flex flex-col items-center gap-5 px-4 py-6">
      {mode === "redo" ? (
        <>
          <div className="w-full max-w-xl flex items-center gap-2">
            <button
              onClick={cancelRedo}
              className="flex items-center gap-1 text-xs text-text-dim hover:text-accent transition-colors"
            >
              <IconChevronLeft className="w-4 h-4" />
              {t.backToCurrent}
            </button>
          </div>

          <p className="w-full max-w-xl text-xs text-accent-dark font-semibold">
            {t.redoHeading}
          </p>

          <QuestionCard question={redoQuestion} />

          {previousEntry && (
            <ChapterPanel
              label={t.previousAnswerLabel}
              questionKo={previousQuestionText}
              chapter={previousEntry.chapter}
              transcript={previousEntry.transcript}
            />
          )}

          {showResendUI ? (
            ResendBlock
          ) : (
            <RecordButton
              step={step}
              recordingSeconds={recordingSeconds}
              statusText={statusText}
              actionLabel={micRetryActive ? t.micRetry : t.redoAction}
              onClick={step === "recording" ? () => stopRecording() : startRecording}
              disabled={busy}
            />
          )}
        </>
      ) : initialLoading ? (
        <div className="w-full max-w-xl flex flex-col gap-5 animate-pulse">
          <div className="h-4 w-40 bg-surface2 rounded" />
          <div className="h-1.5 w-full bg-surface2 rounded-full" />
          <div className="h-36 w-full bg-surface2 rounded-2xl" />
          <div className="h-28 w-28 bg-surface2 rounded-full self-center" />
        </div>
      ) : (
        <>
          <StageProgress currentStageId={currentStageId} stagePosition={stagePosition} />

          {noteText && <p className="w-full max-w-xl text-xs text-accent">{noteText}</p>}

          <QuestionCard question={currentQuestion} />

          {showResendUI ? (
            ResendBlock
          ) : (
            <RecordButton
              step={step}
              recordingSeconds={recordingSeconds}
              statusText={statusText}
              actionLabel={micRetryActive ? t.micRetry : t.recordAction}
              onClick={step === "recording" ? () => stopRecording() : startRecording}
              disabled={(!currentQuestion && step === "idle") || busy}
            />
          )}

          <QuestionActionsRow
            onPrevious={handlePrevious}
            onSkip={handleSkip}
            previousDisabled={busy || loadingPrevious}
            skipDisabled={busy || !currentQuestion}
          />

          {lastChapter && (
            <ChapterPanel label={t.justAnsweredLabel} transcript={lastTranscript} chapter={lastChapter} />
          )}
        </>
      )}
    </main>
  );
}
