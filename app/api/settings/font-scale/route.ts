import { NextRequest, NextResponse } from "next/server";
import { FONT_SCALE_COOKIE, isValidFontScale } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { fontScale } = (await req.json()) as { fontScale?: string };

  if (!isValidFontScale(fontScale)) {
    return NextResponse.json({ error: "Invalid font scale." }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(FONT_SCALE_COOKIE, fontScale, {
    // Not httpOnly: this is a display preference, not a credential, and
    // reading it client-side isn't a risk the way USER_COOKIE would be.
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // a year — a display preference should stick
  });
  return res;
}
