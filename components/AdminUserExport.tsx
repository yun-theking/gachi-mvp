"use client";

import { useState } from "react";

export default function AdminUserExport() {
  const [userId, setUserId] = useState("");
  const [error, setError] = useState("");

  const download = async () => {
    setError("");
    const id = userId.trim();
    if (!id) return;

    const res = await fetch(`/api/admin/export?userId=${encodeURIComponent(id)}`);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error || "다운로드에 실패했습니다.");
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gachi-entries-${id}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full max-w-xs flex flex-col gap-3">
      <p className="text-xs text-text-dim text-center">특정 사용자 번호만 다운로드</p>
      <div className="flex gap-2">
        <input
          type="text"
          inputMode="numeric"
          value={userId}
          onChange={(e) => setUserId(e.target.value.replace(/[^0-9]/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && download()}
          placeholder="사용자 번호"
          className="flex-1 text-center py-3 rounded-2xl bg-surface border border-border text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
        />
        <button
          onClick={download}
          disabled={userId.length === 0}
          className="py-3 px-5 rounded-2xl bg-surface2 border border-border text-text font-medium disabled:opacity-40 transition-opacity"
        >
          다운로드
        </button>
      </div>
      {error && <p className="text-sm text-danger text-center">{error}</p>}
    </div>
  );
}
