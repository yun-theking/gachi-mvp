import { NextRequest, NextResponse } from "next/server";
import { USER_COOKIE } from "@/lib/auth";

const PUBLIC_PREFIXES = ["/login", "/api/login", "/admin", "/api/admin"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const uid = req.cookies.get(USER_COOKIE)?.value;
  if (!uid) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico).*)"],
};
