"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import RecordButton, { type Step } from "@/components/RecordButton";
import QuestionCard, { type BankQuestion } from "@/components/QuestionCard";
import ChapterPanel from "@/components/ChapterPanel";
import StageProgress from "@/components/StageProgress";
import QuestionActionsRow from "@/components/QuestionActionsRow";
import { IconChevronLeft } from "@/components/icons";
import { useLanguage } from "@/components/LanguageProvider";

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

export default function Home() {
  const { lang, dict: t } = useLanguage();

  const [step, setStep] = useState<Step>("idle");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [error, setError] = useState("");
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
      });

      chunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.start(100);
      setStep("recording");
      setRecordingSeconds(0);
      setError("");
      setNoteText("");

      timerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch {
      setError(t.micDenied);
      setStep("error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  const stopRecording = useCallback(() => {
    const mediaRecorder = mediaRecorderRef.current;
    if (!mediaRecorder) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    mediaRecorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      mediaRecorder.stream.getTracks().forEach((t) => t.stop());
      await processAudio(blob);
    };

    mediaRecorder.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeQuestionId, history, mode]);

  const processAudio = async (blob: Blob) => {
    setStep("transcribing");
    try {
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");

      const transcribeRes = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });
      const transcribeData = await transcribeRes.json();
      if (!transcribeRes.ok) throw new Error(transcribeData.error || "STT failed");

      const text: string = transcribeData.text;
      setLastTranscript(text);

      setStep("generating");
      const generateRes = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          questionId: activeQuestionId,
          history: mode === "redo" ? [] : history,
        }),
      });
      const generateData = await generateRes.json();
      if (!generateRes.ok) throw new Error(generateData.error || t.loginErrorGeneric);

      setLastChapter(generateData.chapter);

      if (mode === "redo") {
        // Redoing an old question doesn't move the current pointer — the API
        // returns the same still-current question, so just resync state and
        // hop back to the normal flow.
        setNoteText(t.redoSavedNote);
        setMode("normal");
        setPreviousEntry(null);
      } else if (generateData.stageAdvanced) {
        setNoteText(t.stageAdvancedNote);
      }

      setCurrentQuestion(generateData.nextQuestion);
      setCurrentStageId(generateData.nextQuestion?.life_stage_id ?? null);
      setStagePosition(generateData.stagePosition);
      setProgress(generateData.progress);

      setHistory((prev) => [
        ...prev,
        { role: "user", content: text },
        { role: "assistant", content: JSON.stringify(generateData) },
      ]);

      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loginErrorGeneric);
      setStep("error");
    }
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

  const statusText = (() => {
    if (step === "error") return error;
    if (step === "recording") return t.recording;
    if (step === "transcribing") return t.transcribing;
    if (step === "generating") return t.generating;
    return "";
  })();

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

          <RecordButton
            step={step}
            recordingSeconds={recordingSeconds}
            statusText={statusText}
            actionLabel={t.redoAction}
            onClick={step === "recording" ? stopRecording : startRecording}
            disabled={busy}
          />
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

          <RecordButton
            step={step}
            recordingSeconds={recordingSeconds}
            statusText={statusText}
            actionLabel={t.recordAction}
            onClick={step === "recording" ? stopRecording : startRecording}
            disabled={(!currentQuestion && step === "idle") || busy}
          />

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
