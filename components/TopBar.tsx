"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { IconMenu, IconUser } from "./icons";

const TITLES: Record<string, string> = {
  "/": "가치 인터뷰",
  "/archive": "내 회고록",
  "/settings": "설정",
};

export default function TopBar({ userId }: { userId: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const title =
    TITLES[pathname] ?? (pathname.startsWith("/archive") ? "내 회고록" : "가치 인터뷰");
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
            aria-label="메뉴"
            className="w-9 h-9 flex items-center justify-center rounded-full text-text-dim hover:bg-surface2 transition-colors"
          >
            <IconMenu className="w-5 h-5" />
          </button>
          {menuOpen && (
            <div className="absolute left-0 top-11 w-64 bg-surface border border-border rounded-xl p-4 shadow-lg">
              <p className="font-serif text-accent-dark font-semibold mb-1">가치</p>
              <p className="text-xs text-text-dim leading-relaxed">
                닛케이 「私の履歴書」에서 영감을 받은 106개 질문으로, 목소리로 답하며
                완성하는 나만의 회고록입니다.
              </p>
            </div>
          )}
        </div>

        <h1 className="font-serif text-base font-bold text-text tracking-wide">
          {title}
        </h1>

        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen((v) => !v)}
            aria-label="내 정보"
            className="w-9 h-9 flex items-center justify-center rounded-full text-text-dim hover:bg-surface2 transition-colors"
          >
            <IconUser className="w-5 h-5" />
          </button>
          {profileOpen && userId && (
            <div className="absolute right-0 top-11 w-48 bg-surface border border-border rounded-xl p-3 shadow-lg flex flex-col gap-2">
              <p className="text-xs text-text-dim px-1">
                번호 <span className="text-text font-medium">{userId}</span>
              </p>
              <button
                onClick={logout}
                className="text-xs text-left px-1 py-1.5 rounded-lg hover:bg-surface2 text-accent-dark transition-colors"
              >
                다른 번호로 입장
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
