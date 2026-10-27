"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import RecordButton, { type Step } from "@/components/RecordButton";
import QuestionCard, { type BankQuestion } from "@/components/QuestionCard";
import ChapterPanel from "@/components/ChapterPanel";
import StageProgress from "@/components/StageProgress";
import QuestionActionsRow from "@/components/QuestionActionsRow";
import { IconChevronLeft, IconCheck, IconSpeaker } from "@/components/icons";
import { useLanguage } from "@/components/LanguageProvider";
import { useQuestionSelection } from "@/components/QuestionSelectionProvider";
import OnboardingModal from "@/components/OnboardingModal";
import TranscriptReviewPanel from "@/components/TranscriptReviewPanel";
import { useRecorder, WARNING_AT_SECONDS } from "@/hooks/useRecorder";
import { speak, stopSpeaking, readAloudEnabled } from "@/hooks/useSpeech";
import * as api from "@/lib/interviewApi";
import { stageShortName } from "@/lib/stages";
import type { SavedEntry, StagePos } from "@/lib/interviewApi";

type ErrorKind = "mic" | "network" | "silence" | null;

interface NextQuestion {
  q: BankQuestion | null;
  pos: StagePos | null;
  stageAdvanced: boolean;
  bridge: string | null;
}

const MAX_FOLLOW_UPS = 3;

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
  // A chapter was just written: show the "done" banner until the next action.
  const [justCompleted, setJustCompleted] = useState(false);
  // What speech-to-text heard, waiting for the person to confirm/edit it.
  const [review, setReview] = useState<api.TranscriptReview | null>(null);
  const [reviewText, setReviewText] = useState("");
  const chapterRef = useRef<HTMLDivElement>(null);

  // Follow-up questions about the same story (up to MAX_FOLLOW_UPS). While
  // one is open, the next bank question waits in pendingNext.
  const [followUp, setFollowUp] = useState<{ question: string; index: number } | null>(null);
  const [pendingNext, setPendingNext] = useState<NextQuestion | null>(null);
  const [reaction, setReaction] = useState("");
  const [lastQuestionId, setLastQuestionId] = useState<number | null>(null);
  const [completedStageId, setCompletedStageId] = useState<number | null>(null);
  const [streakDays, setStreakDays] = useState(0);

  // Redo mode: re-answering an already-answered question (the most recent
  // one via "이전 질문", or any one picked from the full question list).
  const [mode, setMode] = useState<"normal" | "redo">("normal");
  const [previousEntry, setPreviousEntry] = useState<SavedEntry | null>(null);
  const [loadingPrevious, setLoadingPrevious] = useState(false);

  // Kept across a failed send so "다시 보내기" can retry without re-recording.
  const pendingBlobRef = useRef<Blob | null>(null);
  const pendingTextRef = useRef<string | null>(null);
  // Measurements for the answer in flight (kept with the blob for retries).
  const metricsRef = useRef<api.AnswerMetrics | null>(null);

  const activeQuestionId =
    mode === "redo" ? previousEntry?.questionId : currentQuestion?.id;

  // When the question (or follow-up) now on screen first appeared — for
  // "time on question". Follow-ups restart it, since the server adds each
  // follow-up's time to the question's total.
  const questionShownAtRef = useRef(Date.now());
  useEffect(() => {
    questionShownAtRef.current = Date.now();
  }, [activeQuestionId, followUp?.question]);

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

  const clearFollowUps = () => {
    setFollowUp(null);
    setPendingNext(null);
  };

  const goToNext = (next: NextQuestion) => {
    applyCurrentQuestion(next.q, next.pos);
    // The overlap note matters more than the stage note when both apply.
    setNoteText(next.bridge ?? (next.stageAdvanced ? t.stageAdvancedNote : ""));
  };

  /** "다음 질문으로 넘어가기": stop the follow-ups and move on. */
  const finishFollowUps = () => {
    stopSpeaking();
    setJustCompleted(false);
    const next = pendingNext;
    clearFollowUps();
    if (next) goToNext(next);
  };

  // ── Read aloud (Settings > 소리로 읽어주기) ──────────────────────────────
  useEffect(() => {
    if (!readAloudEnabled()) return;
    if (followUp) speak([reaction, followUp.question].filter(Boolean).join(" "), lang);
    else if (currentQuestion && mode === "normal")
      speak(lang === "ja" ? currentQuestion.question_ja : currentQuestion.question_ko, lang);
    // Speak when the question or follow-up on screen changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followUp?.question, currentQuestion?.id]);

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
        setStreakDays(data.streakDays ?? 0);
      })
      .catch(() => setNoteText(t.networkErrorMessage))
      .finally(() => setInitialLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Answer pipeline: transcribe → generate chapter → save ────────────────
  const generateChapter = async (text: string) => {
    const data = await api.generate(text, activeQuestionId, metricsRef.current, {
      followUp: followUp ?? undefined,
      // Re-answering an old question just overwrites it — no follow-ups.
      allowFollowUp: mode !== "redo",
    });
    setLastChapter(data.chapter);
    setLastQuestionId(activeQuestionId ?? null);
    setLastTranscript(data.transcript ?? text);
    setReaction(data.reaction ?? "");
    setCompletedStageId(data.completedStageId ?? null);
    setStreakDays(data.streakDays ?? 0);
    setJustCompleted(true);
    // A short buzz on phones that support it, so it's noticed without looking.
    try {
      navigator.vibrate?.(80);
    } catch {
      // Not supported (e.g. iOS Safari) — the banner alone is enough.
    }

    if (mode === "redo") {
      // Re-answering only overwrites that answer. Keep whatever question the
      // person was on before (possibly hand-picked from the list) instead of
      // jumping to the API's suggested next question.
      setNoteText(t.redoSavedNote);
      exitRedo();
      return;
    }

    const next: NextQuestion = {
      q: data.nextQuestion,
      pos: data.stagePosition,
      stageAdvanced: data.stageAdvanced,
      bridge: data.bridge,
    };
    const asked = followUp?.index ?? 0;
    if (data.followUp && asked < MAX_FOLLOW_UPS) {
      // Stay on this story: ask the follow-up, keep the next question waiting.
      setFollowUp({ question: data.followUp, index: asked + 1 });
      setPendingNext(next);
    } else {
      clearFollowUps();
      goToNext(next);
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

    let heard: Awaited<ReturnType<typeof api.transcribe>>;
    try {
      heard = await api.transcribe(blob, activeQuestionId);
    } catch {
      // Audio is kept in pendingBlobRef — "다시 보내기" retries this exact
      // recording without asking the person to talk again.
      showError("network", t.networkErrorMessage);
      return;
    }

    if (!heard.text || heard.text.trim().length < 2) {
      pendingBlobRef.current = null; // nothing useful to resend
      showError("silence", t.silenceMessage);
      return;
    }

    // Show what was heard; the chapter is written only after they confirm.
    setReview(heard.review);
    setReviewText(heard.review.text);
    setStep("review");
  };

  const confirmReview = async () => {
    const text = reviewText.trim();
    if (text.length < 2) return;
    setReview(null);
    pendingTextRef.current = text;
    setLastTranscript(text);
    await runGenerate(text);
  };

  const rerecordFromReview = () => {
    setReview(null);
    pendingBlobRef.current = null;
    pendingTextRef.current = null;
    setStep("idle");
  };

  const recorder = useRecorder({
    onRecorded: (blob, { auto, durationSeconds }) => {
      metricsRef.current = {
        recordingSeconds: durationSeconds,
        timeOnQuestionSeconds: (Date.now() - questionShownAtRef.current) / 1000,
      };
      if (auto) setNoteText(t.recordingAutoStopped);
      void processAudio(blob);
    },
  });

  const startRecording = async () => {
    stopSpeaking();
    setJustCompleted(false);
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
      stopSpeaking();
      setJustCompleted(false);
      setReview(null);
      clearFollowUps();
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
    setJustCompleted(false);
    clearFollowUps();
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
    setReview(null);
    exitRedo();
    setStep("idle");
  };

  const handleSkip = async () => {
    setJustCompleted(false);
    clearFollowUps();
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
  const inReview = step === "review" && review !== null;
  const ReviewBlock = review && (
    <TranscriptReviewPanel
      review={review}
      text={reviewText}
      onChange={setReviewText}
      onConfirm={confirmReview}
      onRerecord={rerecordFromReview}
    />
  );
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
        number: previousEntry.questionNumber,
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

          {inReview ? (
            ReviewBlock
          ) : showResendUI ? (
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
          {justCompleted && lastChapter && (
            <div
              role="status"
              aria-live="polite"
              className="panel-enter w-full max-w-xl rounded-2xl bg-accent-dark text-bg px-5 py-4 flex items-center gap-4"
            >
              <span className="shrink-0 w-10 h-10 rounded-full bg-bg/20 flex items-center justify-center">
                <IconCheck className="w-6 h-6" />
              </span>
              <span className="flex-1 flex flex-col gap-0.5">
                <span className="text-lg font-bold">
                  {completedStageId !== null
                    ? t.stageCompleteTitle(stageShortName(lang, completedStageId))
                    : t.chapterReadyTitle}
                </span>
                <span className="text-sm leading-relaxed opacity-90">{reaction || t.chapterReadyBody}</span>
              </span>
              <button
                onClick={() => chapterRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="shrink-0 min-h-[44px] px-4 rounded-xl bg-bg text-accent-dark font-semibold text-base"
              >
                {t.chapterReadyView}
              </button>
            </div>
          )}

          <StageProgress currentStageId={currentStageId} stagePosition={stagePosition} />

          {streakDays >= 2 && (
            <p className="w-full max-w-xl -mt-2 text-sm font-semibold text-accent-dark">
              {t.streakLabel(streakDays)}
            </p>
          )}

          {noteText && <p className="w-full max-w-xl text-sm text-accent-dark font-semibold">{noteText}</p>}

          <QuestionCard question={currentQuestion} />

          {followUp && (
            <div className="panel-enter w-full max-w-xl rounded-2xl border-2 border-accent bg-bg p-5 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-accent-dark">{t.followUpLabel}</span>
                <span className="text-sm text-text-dim">{t.followUpCount(followUp.index, MAX_FOLLOW_UPS)}</span>
              </div>
              <p className="text-xl font-bold text-text leading-relaxed">{followUp.question}</p>
              <button
                type="button"
                onClick={() => speak(followUp.question, lang)}
                className="self-start flex items-center gap-1 min-h-[40px] px-3 rounded-xl border border-border bg-surface text-sm font-semibold text-accent-dark"
              >
                <IconSpeaker className="w-5 h-5" />
                {t.listen}
              </button>
            </div>
          )}

          {inReview ? (
            ReviewBlock
          ) : showResendUI ? (
            ResendBlock
          ) : (
            <RecordButton
              step={step}
              recordingSeconds={recorder.seconds}
              statusText={statusText}
              actionLabel={micRetryActive ? t.micRetry : followUp ? t.followUpAction : t.recordAction}
              onClick={step === "recording" ? () => recorder.stop() : startRecording}
              disabled={(!currentQuestion && step === "idle") || busy}
            />
          )}

          {followUp ? (
            !busy &&
            !inReview &&
            step !== "recording" && (
              <button
                onClick={finishFollowUps}
                className="w-full max-w-xl py-4 rounded-2xl border-2 border-border bg-surface text-lg font-semibold text-accent-dark hover:bg-surface2 transition-colors"
              >
                {t.followUpNext}
              </button>
            )
          ) : (
            <QuestionActionsRow
              onPrevious={handlePrevious}
              onSkip={handleSkip}
              previousDisabled={busy || inReview || loadingPrevious}
              skipDisabled={busy || inReview || !currentQuestion}
            />
          )}

          {lastChapter && (
            <div ref={chapterRef} className="w-full max-w-xl scroll-mt-20">
              <ChapterPanel
                label={t.justAnsweredLabel}
                transcript={lastTranscript}
                chapter={lastChapter}
                questionId={lastQuestionId}
              />
            </div>
          )}
        </>
      )}
    </main>
  );
}
