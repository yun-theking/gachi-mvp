"use client";

import type { Lang } from "@/lib/auth";

/**
 * Read-aloud with the browser's built-in voices (no API cost). Used for the
 * "듣기" buttons, and automatically for questions, follow-ups and reactions
 * when the person turned on "소리로 읽어주기" in Settings. The preference is
 * per device, since it depends on where the phone is being used.
 */
const PREF_KEY = "gachi_read_aloud";

export function speechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function speak(text: string, lang: Lang) {
  if (!speechSupported() || !text.trim()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang === "ja" ? "ja-JP" : "ko-KR";
  utterance.rate = 0.9; // a little slower than default, easier to follow
  synth.speak(utterance);
}

export function stopSpeaking() {
  if (speechSupported()) window.speechSynthesis.cancel();
}

export function readAloudEnabled(): boolean {
  try {
    return window.localStorage.getItem(PREF_KEY) === "1";
  } catch {
    return false;
  }
}

export function setReadAloudEnabled(on: boolean) {
  try {
    window.localStorage.setItem(PREF_KEY, on ? "1" : "0");
  } catch {
    // Storage blocked: the setting just won't stick across visits.
  }
}
