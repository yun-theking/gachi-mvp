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
  }>(await fetch("/api/next-question"));
}

export async function transcribe(blob: Blob): Promise<string> {
  const formData = new FormData();
  formData.append("audio", blob, "recording.webm");
  const data = await getJson<{ text: string }>(
    await fetch("/api/transcribe", { method: "POST", body: formData })
  );
  return data.text;
}

export async function generate(text: string, questionId: number | undefined) {
  return getJson<GenerateResult>(
    await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, questionId }),
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
