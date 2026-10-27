import type { BankQuestion } from "@/components/QuestionCard";

/** Thin client for the interview screen's API calls. Errors are thrown as
 * plain Errors; the screen shows its own localized message for them. */

export interface StagePos {
  position: number;
  total: number;
}

export interface GenerateResult {
  chapter: string;
  nextQuestion: BankQuestion | null;
  stagePosition: StagePos | null;
  stageAdvanced: boolean;
  done: boolean;
  progress: { totalAnswered: number; totalQuestions: number };
}

export interface SavedEntry {
  questionId: number;
  questionNumber: number | null;
  lifeStageId: number;
  lifeStageKo: string;
  lifeStageJa: string;
  questionKo: string;
  questionJa: string;
  transcript: string;
  chapter: string;
}

async function getJson<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
  return data as T;
}

export async function fetchNextQuestion() {
  return getJson<{
    nextQuestion: BankQuestion | null;
    stagePosition: StagePos | null;
    progress?: { totalAnswered: number; totalQuestions: number };
    needsFields?: boolean;
    showOnboarding?: boolean;
  }>(await fetch("/api/next-question"));
}

/** Records (on the account) that the tutorial was finished or skipped. */
export async function markOnboardingSeen() {
  await getJson<{ ok: true }>(await fetch("/api/settings/onboarding", { method: "POST" }));
}

export interface TranscriptReview {
  text: string;
  corrections: { from: string; to: string }[];
  uncertain: string[];
}

/** Speech-to-text plus the review pass (obvious fixes + doubtful words). */
export async function transcribe(
  blob: Blob,
  questionId: number | undefined
): Promise<{ text: string; review: TranscriptReview }> {
  const formData = new FormData();
  formData.append("audio", blob, "recording.webm");
  if (questionId) formData.append("questionId", String(questionId));
  const data = await getJson<{ text: string; review?: TranscriptReview }>(
    await fetch("/api/transcribe", { method: "POST", body: formData })
  );
  return {
    text: data.text,
    review: data.review ?? { text: data.text, corrections: [], uncertain: [] },
  };
}

export interface AnswerMetrics {
  recordingSeconds: number;
  timeOnQuestionSeconds: number;
}

export async function generate(
  text: string,
  questionId: number | undefined,
  metrics: AnswerMetrics | null
) {
  return getJson<GenerateResult>(
    await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, questionId, ...metrics }),
    })
  );
}

/** A saved answer: a specific question's, or the most recent one if no id. */
export async function fetchSavedEntry(questionId?: number) {
  const url = questionId
    ? `/api/previous-question?questionId=${questionId}`
    : "/api/previous-question";
  return getJson<{ entry: SavedEntry | null }>(await fetch(url));
}

export async function skip(questionId: number) {
  return getJson<{ nextQuestion: BankQuestion | null; stagePosition: StagePos | null }>(
    await fetch("/api/skip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId }),
    })
  );
}
