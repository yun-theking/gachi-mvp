"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const MAX_RECORDING_SECONDS = 600; // 10 minutes
export const WARNING_AT_SECONDS = 570; // warn 30s before auto-stop

interface Options {
  /** Called with the finished recording. `auto` is true when it was stopped
   * by the 10-minute limit rather than by the person. */
  onRecorded: (blob: Blob, info: { auto: boolean }) => void;
}

/**
 * Microphone recording, isolated from the interview screen's UI state.
 *
 * `onRecorded` is read through a ref, so the latest version (with the
 * screen's current question/mode) is always the one called — no stale
 * closures and no need for the caller to memoize it.
 */
export function useRecorder({ onRecorded }: Options) {
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onRecordedRef = useRef(onRecorded);
  onRecordedRef.current = onRecorded;

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const stop = useCallback((auto = false) => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    clearTimer();
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      recorder.stream.getTracks().forEach((track) => track.stop());
      recorderRef.current = null;
      setIsRecording(false);
      onRecordedRef.current(blob, { auto });
    };
    recorder.stop();
  }, []);

  /** Throws away an in-progress recording without calling onRecorded. */
  const cancel = useCallback(() => {
    const recorder = recorderRef.current;
    clearTimer();
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.stop();
      recorder.stream.getTracks().forEach((track) => track.stop());
    }
    recorderRef.current = null;
    setIsRecording(false);
  }, []);

  /** Starts recording. Resolves false if the microphone isn't available
   * (permission denied, no device), so the caller can show its own message. */
  const start = useCallback(async (): Promise<boolean> => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return false;
    }

    const recorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm",
      // Bounds file size predictably: ~4.8MB for a full 10-minute take,
      // safely under Whisper's 25MB limit.
      audioBitsPerSecond: 64000,
    });
    chunksRef.current = [];
    recorderRef.current = recorder;
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.start(100);

    setSeconds(0);
    setIsRecording(true);
    timerRef.current = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
    return true;
  }, []);

  // Auto-stop at the limit (kept out of the setState updater, which must
  // stay side-effect free).
  useEffect(() => {
    if (isRecording && seconds >= MAX_RECORDING_SECONDS) stop(true);
  }, [isRecording, seconds, stop]);

  // Release the microphone if the screen unmounts mid-recording.
  useEffect(() => cancel, [cancel]);

  return { isRecording, seconds, start, stop, cancel };
}
