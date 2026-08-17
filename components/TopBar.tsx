"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { IconMenu, IconUser } from "./icons";
import { useLanguage } from "./LanguageProvider";

export default function TopBar({ userId }: { userId: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const { dict: t } = useLanguage();

  const title = pathname.startsWith("/archive")
    ? t.navArchive
    : pathname.startsWith("/settings")
    ? t.navSettings
    : t.appName + " " + t.navInterview;

  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const logout = async () => {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-20 bg-bg/95 backdrop-blur border-b border-border">
      <div className="max-w-xl mx-auto flex items-center justify-between px-4 h-14">
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="menu"
            className="w-9 h-9 flex items-center justify-center rounded-full text-text-dim hover:bg-surface2 transition-colors"
          >
            <IconMenu className="w-5 h-5" />
          </button>
          {menuOpen && (
            <div className="absolute left-0 top-11 w-64 bg-surface border border-border rounded-xl p-4 shadow-lg">
              <p className="font-serif text-accent-dark font-semibold mb-1">{t.appName}</p>
              <p className="text-xs text-text-dim leading-relaxed">{t.appTagline}</p>
            </div>
          )}
        </div>

        <h1 className="font-serif text-base font-bold text-text tracking-wide">{title}</h1>

        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen((v) => !v)}
            aria-label="profile"
            className="w-9 h-9 flex items-center justify-center rounded-full text-text-dim hover:bg-surface2 transition-colors"
          >
            <IconUser className="w-5 h-5" />
          </button>
          {profileOpen && userId && (
            <div className="absolute right-0 top-11 w-48 bg-surface border border-border rounded-xl p-3 shadow-lg flex flex-col gap-2">
              <p className="text-xs text-text-dim px-1">
                {t.myNumber} <span className="text-text font-medium">{userId}</span>
              </p>
              <button
                onClick={logout}
                className="text-xs text-left px-1 py-1.5 rounded-lg hover:bg-surface2 text-accent-dark transition-colors"
              >
                {t.switchNumber}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
