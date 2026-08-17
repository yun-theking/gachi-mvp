"use client";

import { useState } from "react";

export default function AdminLoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "인증 실패");
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-xs flex flex-col gap-4">
      <input
        type="password"
        autoFocus
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="관리자 비밀번호"
        className="w-full text-center text-lg py-4 rounded-2xl bg-surface border border-border text-text placeholder:text-text-muted focus:outline-none focus:border-gold"
      />
      {error && <p className="text-sm text-danger text-center">{error}</p>}
      <button
        onClick={submit}
        disabled={loading || password.length === 0}
        className="w-full py-4 rounded-2xl bg-gold text-bg font-semibold tracking-wide disabled:opacity-40 transition-opacity"
      >
        {loading ? "확인 중…" : "확인"}
      </button>
    </div>
  );
}
