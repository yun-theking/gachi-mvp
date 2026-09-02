"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import type { Lang } from "@/lib/auth";
import { getDict } from "@/lib/i18n";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [lang, setLang] = useState<Lang>("ko");
  const [userId, setUserId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const t = getDict(lang);

  const submit = async () => {
    if (!/^[0-9]{4}$/.test(userId)) {
      setError(t.loginErrorFormat);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, language: lang }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t.loginErrorGeneric);
      router.replace(searchParams.get("next") || "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loginErrorGeneric);
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 py-12 px-4">
      <header className="text-center mb-2 flex flex-col items-center gap-3">
        <Image src="/logo.png" alt="Gachi" width={161} height={68} priority />
        <p className="text-sm text-text-dim">{t.loginSubtitle}</p>
      </header>

      <div className="w-full max-w-xs flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <p className="text-xs text-text-muted text-center">{t.loginLanguageLabel}</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setLang("ko")}
              className={`py-3 rounded-2xl border font-medium transition-colors ${
                lang === "ko"
                  ? "bg-accent text-bg border-accent"
                  : "bg-surface text-text-dim border-border hover:bg-surface2"
              }`}
            >
              한국어
            </button>
            <button
              type="button"
              onClick={() => setLang("ja")}
              className={`py-3 rounded-2xl border font-medium transition-colors ${
                lang === "ja"
                  ? "bg-accent text-bg border-accent"
                  : "bg-surface text-text-dim border-border hover:bg-surface2"
              }`}
            >
              日本語
            </button>
          </div>
        </div>

        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoFocus
          value={userId}
          onChange={(e) => setUserId(e.target.value.replace(/[^0-9]/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={t.loginPlaceholder}
          maxLength={4}
          className="w-full text-center text-3xl tracking-widest py-5 rounded-2xl bg-surface border border-border text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
        />

        {error && <p className="text-sm text-danger text-center">{error}</p>}

        <button
          onClick={submit}
          disabled={loading || userId.length === 0}
          className="w-full py-5 rounded-2xl bg-accent text-bg font-semibold text-lg tracking-wide disabled:opacity-40 transition-opacity"
        >
          {loading ? t.loginButtonLoading : t.loginButton}
        </button>

        <p className="text-xs text-text-muted text-center leading-relaxed">
          {t.loginHint1}
          <br />
          {t.loginHint2}
        </p>
      </div>
    </main>
  );
}
