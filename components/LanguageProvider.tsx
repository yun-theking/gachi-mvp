"use client";

import { createContext, useContext } from "react";
import type { Lang } from "@/lib/auth";
import { getDict, type Dict } from "@/lib/i18n";

const LanguageContext = createContext<{ lang: Lang; dict: Dict }>({
  lang: "ko",
  dict: getDict("ko"),
});

export function LanguageProvider({
  lang,
  children,
}: {
  lang: Lang;
  children: React.ReactNode;
}) {
  return (
    <LanguageContext.Provider value={{ lang, dict: getDict(lang) }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
