"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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
  const [userId, setUserId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!/^[0-9]{1,10}$/.test(userId)) {
      setError("숫자로만 1~10자리 입력해주세요.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "입장 실패");
      router.replace(searchParams.get("next") || "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 py-12 px-4">
      <header className="text-center mb-2">
        <div className="flex items-center justify-center gap-3 mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-gold" />
          <h1 className="font-serif text-3xl font-bold text-gold-light tracking-wide">
            가치
          </h1>
          <span className="w-1.5 h-1.5 rounded-full bg-gold" />
        </div>
        <p className="text-sm text-text-dim">
          나만의 번호를 입력하고 입장해주세요
        </p>
      </header>

      <div className="w-full max-w-xs flex flex-col gap-4">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoFocus
          value={userId}
          onChange={(e) => setUserId(e.target.value.replace(/[^0-9]/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="예: 1234"
          maxLength={10}
          className="w-full text-center text-3xl tracking-widest py-5 rounded-2xl bg-surface border border-border text-text placeholder:text-text-muted focus:outline-none focus:border-gold"
        />

        {error && <p className="text-sm text-danger text-center">{error}</p>}

        <button
          onClick={submit}
          disabled={loading || userId.length === 0}
          className="w-full py-5 rounded-2xl bg-gold text-bg font-semibold text-lg tracking-wide disabled:opacity-40 transition-opacity"
        >
          {loading ? "입장 중…" : "입장하기"}
        </button>

        <p className="text-xs text-text-muted text-center leading-relaxed">
          처음 입력하는 번호면 자동으로 새 계정이 만들어져요.
          <br />
          다음에 올 때도 같은 번호로 들어오면 이어서 진행돼요.
        </p>
      </div>
    </main>
  );
}
