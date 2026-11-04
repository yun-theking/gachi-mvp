"use client";

import type { Lang } from "@/lib/auth";

/**
 * Read-aloud. Uses a natural OpenAI voice from /api/tts; if that fails
 * (offline, server error) it falls back to the phone's built-in voice so
 * the button still does something. Used for the "듣기" buttons, and
 * automatically for questions, follow-ups and reactions when "소리로
 * 읽어주기" is on in Settings (a per-device preference).
 */
const PREF_KEY = "gachi_read_aloud";
const MAX_CACHED = 40;

// One shared player. iPhones only allow audio that was started inside a tap,
// so the first tap "unlocks" this element with a moment of silence; later
// plays (including automatic read-aloud) reuse the unlocked element.
let player: HTMLAudioElement | null = null;
let unlocked = false;
let playSeq = 0;
const audioUrls = new Map<string, string>(); // `${lang}|${text}` -> blob URL

// 50 ms of silence (8 kHz mono WAV), built once.
function silentWav(): string {
  const samples = 400;
  const buf = new ArrayBuffer(44 + samples * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + samples * 2, true);
  str(8, "WAVEfmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true);
  v.setUint32(28, 16000, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, samples * 2, true);
  return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
}

function getPlayer(): HTMLAudioElement | null {
  if (typeof window === "undefined" || typeof Audio === "undefined") return null;
  if (!player) player = new Audio();
  return player;
}

/** Call from a tap (record button, settings toggle) so later automatic
 * read-aloud is allowed to play on iPhones. Safe to call repeatedly. */
export function unlockAudio() {
  const p = getPlayer();
  if (!p || unlocked) return;
  unlocked = true;
  p.src = silentWav();
  p.play().catch(() => {
    unlocked = false;
  });
}

export function speechSupported(): boolean {
  return typeof window !== "undefined" && (typeof Audio !== "undefined" || "speechSynthesis" in window);
}

function speakWithDeviceVoice(text: string, lang: Lang) {
  if (!("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang === "ja" ? "ja-JP" : "ko-KR";
  u.rate = 0.9;
  window.speechSynthesis.speak(u);
}

async function naturalVoiceUrl(text: string, lang: Lang): Promise<string> {
  const key = `${lang}|${text}`;
  const hit = audioUrls.get(key);
  if (hit) return hit;
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, lang }),
  });
  if (!res.ok) throw new Error(`tts ${res.status}`);
  const url = URL.createObjectURL(await res.blob());
  audioUrls.set(key, url);
  if (audioUrls.size > MAX_CACHED) {
    const [oldKey, oldUrl] = audioUrls.entries().next().value as [string, string];
    URL.revokeObjectURL(oldUrl);
    audioUrls.delete(oldKey);
  }
  return url;
}

export function speak(text: string, lang: Lang) {
  if (typeof window === "undefined" || !text.trim()) return;
  stopSpeaking();
  unlockAudio(); // no-op after the first tap
  const mySeq = ++playSeq;

  void (async () => {
    try {
      const url = await naturalVoiceUrl(text.trim(), lang);
      const p = getPlayer();
      if (mySeq !== playSeq || !p) return; // something newer started, or stopped
      p.src = url;
      await p.play();
    } catch (err) {
      if (mySeq !== playSeq) return;
      // Blocked by the browser (no tap yet): stay quiet rather than fall back,
      // the built-in voice would be blocked too.
      if (err instanceof DOMException && err.name === "NotAllowedError") return;
      speakWithDeviceVoice(text, lang);
    }
  })();
}

export function stopSpeaking() {
  playSeq++;
  if (player && !player.paused) player.pause();
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
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
