"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import RecordButton, { type Step } from "@/components/RecordButton";
import QuestionCard, { type BankQuestion } from "@/components/QuestionCard";
import ChapterPanel from "@/components/ChapterPanel";
import StageProgress from "@/components/StageProgress";
import QuestionActionsRow from "@/components/QuestionActionsRow";
import { IconChevronLeft } from "@/components/icons";
import { useLanguage } from "@/components/LanguageProvider";
import { useQuestionSelection } from "@/components/QuestionSelectionProvider";
import OnboardingModal from "@/components/OnboardingModal";
import { useRecorder, WARNING_AT_SECONDS } from "@/hooks/useRecorder";
import * as api from "@/lib/interviewApi";
import type { SavedEntry, StagePos } from "@/lib/interviewApi";

type ErrorKind = "mic" | "network" | "silence" | null;

export default function Home() {
  const { lang, dict: t } = useLanguage();
  const { pendingSelection, consumeSelection } = useQuestionSelection();

  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState("");
  const [errorKind, setErrorKind] = useState<ErrorKind>(null);

  const [currentQuestion, setCurrentQuestion] = useState<BankQuestion | null>(null);
  const [currentStageId, setCurrentStageId] = useState<number | null>(1);
  const [stagePosition, setStagePosition] = useState<StagePos | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const [lastTranscript, setLastTranscript] = useState("");
  const [lastChapter, setLastChapter] = useState("");
  const [noteText, setNoteText] = useState("");

  // Redo mode: re-answering an already-answered question (the most recent
  // one via "이전 질문", or any one picked from the full question list).
  const [mode, setMode] = useState<"normal" | "redo">("normal");
  const [previousEntry, setPreviousEntry] = useState<SavedEntry | null>(null);
  const [loadingPrevious, setLoadingPrevious] = useState(false);

  // Kept across a failed send so "다시 보내기" can retry without re-recording.
  const pendingBlobRef = useRef<Blob | null>(null);
  const pendingTextRef = useRef<string | null>(null);

  const activeQuestionId =
    mode === "redo" ? previousEntry?.questionId : currentQuestion?.id;

  const showError = (kind: Exclude<ErrorKind, null>, message: string) => {
    setError(message);
    setErrorKind(kind);
    setStep("error");
  };

  const clearError = () => {
    setError("");
    setErrorKind(null);
  };

  const applyCurrentQuestion = (q: BankQuestion | null, pos: StagePos | null) => {
    setCurrentQuestion(q);
    setCurrentStageId(q?.life_stage_id ?? null);
    setStagePosition(pos);
  };

  const enterRedo = (entry: SavedEntry) => {
    setPreviousEntry(entry);
    setMode("redo");
    setStep("idle");
  };

  const exitRedo = () => {
    setMode("normal");
    setPreviousEntry(null);
  };

  // ── Initial load ─────────────────────────────────────────────────────────
  useEffect(() => {
    api
      .fetchNextQuestion()
      .then((data) => {
        if (data.needsFields) {
          window.location.href = "/fields?next=/";
          return;
        }
        applyCurrentQuestion(data.nextQuestion, data.stagePosition);
        setShowOnboarding(!!data.showOnboarding);
      })
      .catch(() => setNoteText(t.networkErrorMessage))
      .finally(() => setInitialLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Answer pipeline: transcribe → generate chapter → save ────────────────
  const generateChapter = async (text: string) => {
    const data = await api.generate(text, activeQuestionId);
    setLastChapter(data.chapter);

    if (mode === "redo") {
      // Re-answering only overwrites that answer. Keep whatever question the
      // person was on before (possibly hand-picked from the list) instead of
      // jumping to the API's suggested next question.
      setNoteText(t.redoSavedNote);
      exitRedo();
    } else {
      if (data.stageAdvanced) setNoteText(t.stageAdvancedNote);
      applyCurrentQuestion(data.nextQuestion, data.stagePosition);
    }
  };

  const runGenerate = async (text: string) => {
    setStep("generating");
    try {
      await generateChapter(text);
    } catch {
      showError("network", t.networkErrorMessage);
      return;
    }
    pendingBlobRef.current = null;
    pendingTextRef.current = null;
    setStep("done");
  };

  const processAudio = async (blob: Blob) => {
    pendingBlobRef.current = blob;
    pendingTextRef.current = null;
    setErrorKind(null);
    setStep("transcribing");

    let text: string;
    try {
      text = await api.transcribe(blob);
    } catch {
      // Audio is kept in pendingBlobRef — "다시 보내기" retries this exact
      // recording without asking the person to talk again.
      showError("network", t.networkErrorMessage);
      return;
    }

    if (!text || text.trim().length < 2) {
      pendingBlobRef.current = null; // nothing useful to resend
      showError("silence", t.silenceMessage);
      return;
    }

    pendingTextRef.current = text;
    setLastTranscript(text);
    await runGenerate(text);
  };

  const recorder = useRecorder({
    onRecorded: (blob, { auto }) => {
      if (auto) setNoteText(t.recordingAutoStopped);
      void processAudio(blob);
    },
  });

  const startRecording = async () => {
    pendingBlobRef.current = null;
    pendingTextRef.current = null;
    const ok = await recorder.start();
    if (!ok) {
      showError("mic", t.micDenied);
      return;
    }
    clearError();
    setNoteText("");
    setStep("recording");
  };

  const resend = async () => {
    setError("");
    if (pendingTextRef.current) {
      // Already transcribed — resume from the generate step only.
      await runGenerate(pendingTextRef.current);
    } else if (pendingBlobRef.current) {
      await processAudio(pendingBlobRef.current);
    }
  };

  const discardAndRerecord = () => {
    pendingBlobRef.current = null;
    pendingTextRef.current = null;
    clearError();
    setStep("idle");
  };

  // ── Picking a question from the full list ────────────────────────────────
  // If a recording was in progress it's abandoned: jumping to a different
  // question mid-recording means that take no longer belongs anywhere.
  const handlePicked = useCallback(
    async (picked: NonNullable<typeof pendingSelection>) => {
      recorder.cancel();
      pendingBlobRef.current = null;
      pendingTextRef.current = null;
      clearError();
      setLastChapter("");
      setStep("idle");
      setNoteText("");

      if (picked.answered) {
        // Open it in redo mode with the saved answer shown. The current
        // question is left alone so "현재 질문으로 돌아가기" still works.
        try {
          const data = await api.fetchSavedEntry(picked.id);
          if (!data.entry) throw new Error("not found");
          enterRedo(data.entry);
        } catch {
          exitRedo();
          setNoteText(t.networkErrorMessage);
        }
        return;
      }

      exitRedo();
      applyCurrentQuestion(picked, picked.stagePosition);
      setNoteText(t.questionSelectedNote);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [recorder.cancel, t]
  );

  useEffect(() => {
    if (!pendingSelection) return;
    const picked = pendingSelection;
    consumeSelection();
    void handlePicked(picked);
  }, [pendingSelection, consumeSelection, handlePicked]);

  // ── Previous / skip ──────────────────────────────────────────────────────
  const handlePrevious = async () => {
    setLoadingPrevious(true);
    setNoteText("");
    try {
      const data = await api.fetchSavedEntry();
      if (!data.entry) {
        setNoteText(t.noPreviousNote);
        return;
      }
      enterRedo(data.entry);
    } catch {
      setNoteText(t.networkErrorMessage);
    } finally {
      setLoadingPrevious(false);
    }
  };

  const cancelRedo = () => {
    exitRedo();
    setStep("idle");
  };

  const handleSkip = async () => {
    if (!currentQuestion) return;
    setNoteText("");
    try {
      const data = await api.skip(currentQuestion.id);
      applyCurrentQuestion(data.nextQuestion, data.stagePosition);
      setNoteText(t.skippedNote);
    } catch {
      setNoteText(t.networkErrorMessage);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  const busy = step === "transcribing" || step === "generating";
  const showResendUI = step === "error" && errorKind === "network";

  const statusText = (() => {
    if (step === "error") return error;
    if (step === "recording") {
      return recorder.seconds >= WARNING_AT_SECONDS ? t.recordingTimeWarning : t.recording;
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
      <p className="text-base text-danger text-center">{error}</p>
      <button
        onClick={resend}
        className="w-full py-4 rounded-2xl bg-accent text-bg font-semibold text-lg tracking-wide"
      >
        {t.resend}
      </button>
      <button
        onClick={discardAndRerecord}
        className="text-sm text-text-dim underline hover:text-accent-dark transition-colors"
      >
        {t.rerecordInstead}
      </button>
    </div>
  );

  return (
    <main className="min-h-screen flex flex-col items-center gap-5 px-4 py-6">
      {showOnboarding && (
        <OnboardingModal
          onFinish={() => {
            setShowOnboarding(false);
            // Best-effort: if this fails, the tutorial just shows once more next visit.
            api.markOnboardingSeen().catch(() => {});
          }}
        />
      )}
      {mode === "redo" ? (
        <>
          <div className="w-full max-w-xl flex items-center gap-2">
            <button
              onClick={cancelRedo}
              className="flex items-center gap-1 text-sm text-text-dim hover:text-accent-dark transition-colors"
            >
              <IconChevronLeft className="w-5 h-5" />
              {t.backToCurrent}
            </button>
          </div>

          <p className="w-full max-w-xl text-sm text-accent-dark font-semibold">
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
              recordingSeconds={recorder.seconds}
              statusText={statusText}
              actionLabel={micRetryActive ? t.micRetry : t.redoAction}
              onClick={step === "recording" ? () => recorder.stop() : startRecording}
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

          {noteText && <p className="w-full max-w-xl text-sm text-accent-dark font-semibold">{noteText}</p>}

          <QuestionCard question={currentQuestion} />

          {showResendUI ? (
            ResendBlock
          ) : (
            <RecordButton
              step={step}
              recordingSeconds={recorder.seconds}
              statusText={statusText}
              actionLabel={micRetryActive ? t.micRetry : t.recordAction}
              onClick={step === "recording" ? () => recorder.stop() : startRecording}
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
