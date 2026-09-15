"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import type { BankQuestion } from "./QuestionCard";
import type { StagePosition } from "@/lib/questions";

/** A question picked from the full 108-question list, plus its position within
 * its own stage — computed client-side from the already-fetched list, so
 * picking a question doesn't need an extra round trip. */
export interface SelectedQuestion extends BankQuestion {
  stagePosition: StagePosition;
}

interface QuestionSelectionContextValue {
  isListOpen: boolean;
  openList: () => void;
  closeList: () => void;
  pendingSelection: SelectedQuestion | null;
  selectQuestion: (q: SelectedQuestion) => void;
  consumeSelection: () => void;
}

const QuestionSelectionContext = createContext<QuestionSelectionContextValue | null>(null);

export function QuestionSelectionProvider({ children }: { children: ReactNode }) {
  const [isListOpen, setIsListOpen] = useState(false);
  const [pendingSelection, setPendingSelection] = useState<SelectedQuestion | null>(null);

  const openList = useCallback(() => setIsListOpen(true), []);
  const closeList = useCallback(() => setIsListOpen(false), []);
  const selectQuestion = useCallback((q: SelectedQuestion) => {
    setPendingSelection(q);
    setIsListOpen(false);
  }, []);
  const consumeSelection = useCallback(() => setPendingSelection(null), []);

  return (
    <QuestionSelectionContext.Provider
      value={{ isListOpen, openList, closeList, pendingSelection, selectQuestion, consumeSelection }}
    >
      {children}
    </QuestionSelectionContext.Provider>
  );
}

export function useQuestionSelection() {
  const ctx = useContext(QuestionSelectionContext);
  if (!ctx) {
    throw new Error("useQuestionSelection must be used within QuestionSelectionProvider");
  }
  return ctx;
}
