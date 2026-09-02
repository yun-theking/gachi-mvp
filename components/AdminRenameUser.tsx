"use client";

import { useState } from "react";

export default function AdminRenameUser() {
  const [oldId, setOldId] = useState("");
  const [newId, setNewId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const rename = async () => {
    setError("");
    setSuccess(false);
    if (oldId.length !== 4 || newId.length !== 4) return;

    setLoading(true);
    try {
      const res = await fetch("/api/admin/rename-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldId, newId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to rename account.");
      setSuccess(true);
      setOldId("");
      setNewId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-xs flex flex-col gap-3">
      <p className="text-xs text-text-dim text-center">
        Forgotten number recovery: move an account to a new number
      </p>
      <div className="flex flex-col gap-2">
        <input
          type="text"
          inputMode="numeric"
          value={oldId}
          onChange={(e) => {
            setOldId(e.target.value.replace(/[^0-9]/g, "").slice(0, 4));
            setSuccess(false);
            setError("");
          }}
          placeholder="Old number"
          maxLength={4}
          className="w-full text-center py-3 rounded-2xl bg-surface border border-border text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
        />
        <input
          type="text"
          inputMode="numeric"
          value={newId}
          onChange={(e) => {
            setNewId(e.target.value.replace(/[^0-9]/g, "").slice(0, 4));
            setSuccess(false);
            setError("");
          }}
          onKeyDown={(e) => e.key === "Enter" && rename()}
          placeholder="New number"
          maxLength={4}
          className="w-full text-center py-3 rounded-2xl bg-surface border border-border text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
        />
        <button
          onClick={rename}
          disabled={loading || oldId.length !== 4 || newId.length !== 4}
          className="w-full py-3 rounded-2xl bg-surface2 border border-border text-text font-medium disabled:opacity-40 transition-opacity"
        >
          {loading ? "…" : "Rename"}
        </button>
      </div>
      {error && <p className="text-sm text-danger text-center">{error}</p>}
      {success && (
        <p className="text-sm text-text text-center">
          Done — the account&apos;s records now live under the new number.
        </p>
      )}
    </div>
  );
}
