"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useLanguage } from "./LanguageProvider";
import { IconMic, IconBook } from "./icons";

const SEEN_KEY = "gachi_onboarding_seen_v1";

/** Step 1 illustration: the app's own mic button, at rest — establishes the
 * one gesture ("press this, then talk") before anything else is explained. */
function WelcomeIllustration() {
  return (
    <div className="flex flex-col items-center gap-4 py-2">
      <Image src="/logo.png" alt="Gachi" width={120} height={51} priority />
      <div className="w-24 h-24 rounded-full flex items-center justify-center shadow-lg bg-gradient-to-br from-accent to-accent-dark">
        <IconMic className="w-10 h-10 text-white" />
      </div>
    </div>
  );
}

/** Step 2 illustration: a miniature of the real question card + record
 * button, connected with an arrow, so the shapes match what they'll
 * actually see one step later instead of an abstract diagram. */
function AnswerIllustration() {
  const { lang, dict: t } = useLanguage();
  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <div className="w-full max-w-[280px] bg-surface border border-border rounded-2xl p-4 flex flex-col gap-2">
        <span className="text-xs font-semibold text-accent-dark">
          {lang === "ja" ? "幼少期・成長背景" : "유년기·성장배경"}
        </span>
        <p className="font-bold text-text text-base leading-relaxed">
          {t.onboardingSampleQuestion}
        </p>
      </div>
      <svg viewBox="0 0 24 24" className="w-6 h-6 text-text-muted" fill="none">
        <path d="M12 4v14M12 18l-5-5M12 18l5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg bg-gradient-to-br from-accent to-accent-dark">
        <IconMic className="w-7 h-7 text-white" />
      </div>
    </div>
  );
}

/** Step 3 illustration: a miniature chapter card feeding into the archive
 * (book) icon, showing where the answer ends up. */
function ArchiveIllustration() {
  const { dict: t } = useLanguage();
  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <div className="w-full max-w-[280px] bg-surface border border-border rounded-2xl p-4 flex flex-col gap-2">
        <span className="text-xs tracking-widest uppercase text-accent-dark">
          {t.chapterLabelDefault}
        </span>
        <p className="font-serif text-text text-sm leading-7">{t.onboardingSampleChapter}</p>
      </div>
      <svg viewBox="0 0 24 24" className="w-6 h-6 text-text-muted" fill="none">
        <path d="M12 4v14M12 18l-5-5M12 18l5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="w-16 h-16 rounded-full flex items-center justify-center bg-surface2 border border-border">
        <IconBook className="w-7 h-7 text-accent-dark" />
      </div>
    </div>
  );
}

export default function OnboardingModal({ hasAnsweredAny }: { hasAnsweredAny: boolean }) {
  const { dict: t } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    setMounted(true);

    // Already has at least one answered question — definitely not this
    // person's first visit (covers a new browser/device on the same
    // account too), so skip the tutorial without even checking storage.
    if (hasAnsweredAny) return;

    try {
      if (!window.localStorage.getItem(SEEN_KEY)) {
        setOpen(true);
      }
    } catch {
      // localStorage unavailable (e.g. blocked storage) — just skip the
      // tutorial rather than showing it every visit.
    }
  }, [hasAnsweredAny]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const finish = () => {
    try {
      window.localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // Best-effort: worst case the tutorial reappears next visit.
    }
    setOpen(false);
  };

  if (!mounted || !open) return null;

  const steps = [
    { Illustration: WelcomeIllustration, title: t.onboardingStep1Title, body: t.onboardingStep1Body },
    { Illustration: AnswerIllustration, title: t.onboardingStep2Title, body: t.onboardingStep2Body },
    { Illustration: ArchiveIllustration, title: t.onboardingStep3Title, body: t.onboardingStep3Body },
  ];
  const isLast = step === steps.length - 1;
  const Current = steps[step].Illustration;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex flex-col bg-bg">
      <div className="flex justify-end px-4 pt-4">
        <button
          onClick={finish}
          className="text-base font-semibold text-text-dim underline hover:text-accent-dark transition-colors py-2.5 px-3 min-h-[44px]"
        >
          {t.onboardingSkip}
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 -mt-8">
        <Current />

        <div className="flex flex-col items-center gap-2 max-w-sm">
          <h2 className="font-serif text-xl font-bold text-text text-center">
            {steps[step].title}
          </h2>
          <p className="text-base text-text-dim text-center leading-relaxed">
            {steps[step].body}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {steps.map((_, i) => (
            <span
              key={i}
              className={`w-2.5 h-2.5 rounded-full transition-colors ${
                i === step ? "bg-accent" : "bg-border"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="px-6 pb-8 pt-2 max-w-xl w-full mx-auto">
        <button
          onClick={() => (isLast ? finish() : setStep((s) => s + 1))}
          className="w-full py-4 rounded-2xl bg-accent text-bg font-semibold text-lg tracking-wide"
        >
          {isLast ? t.onboardingStart : t.onboardingNext}
        </button>
      </div>
    </div>,
    document.body
  );
}
