"use client";

import { usePathname } from "next/navigation";
import TopBar from "./TopBar";
import BottomNav from "./BottomNav";

const NO_CHROME_PREFIXES = ["/login", "/admin"];

export default function AppChrome({
  userId,
  children,
}: {
  userId: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const showChrome = !NO_CHROME_PREFIXES.some((p) => pathname.startsWith(p));

  if (!showChrome) {
    return <>{children}</>;
  }

  return (
    <>
      <TopBar userId={userId} />
      <div className="pb-20">{children}</div>
      <BottomNav />
    </>
  );
}
