"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconKey, IconBook, IconGear } from "./icons";
import { useLanguage } from "./LanguageProvider";

export default function BottomNav() {
  const pathname = usePathname();
  const { dict: t } = useLanguage();

  const TABS = [
    { href: "/", label: t.navInterview, Icon: IconKey },
    { href: "/archive", label: t.navArchive, Icon: IconBook },
    { href: "/settings", label: t.navSettings, Icon: IconGear },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 bg-bg/95 backdrop-blur border-t border-border">
      <div className="max-w-xl mx-auto flex items-stretch">
        {TABS.map(({ href, label, Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-[0.65rem] tracking-wide transition-colors ${
                active ? "text-accent" : "text-text-muted"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className={active ? "font-semibold" : ""}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
