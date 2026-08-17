import { NextRequest, NextResponse } from "next/server";
import { registerUser } from "@/lib/questions";
import { USER_COOKIE, LANG_COOKIE, DEFAULT_LANG, isValidUserId, isValidLang } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { userId, language } = (await req.json()) as { userId?: string; language?: string };

  if (!userId || !isValidUserId(userId)) {
    return NextResponse.json(
      { error: "숫자로만 1~10자리 입력해주세요." },
      { status: 400 }
    );
  }

  const lang = isValidLang(language) ? language : DEFAULT_LANG;

  await registerUser(userId, lang);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(USER_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    // No maxAge on purpose: session cookie, cleared when the browser is fully
    // closed. Prevents the next person on a shared device from silently
    // continuing as the previous person's number.
    path: "/",
  });
  res.cookies.set(LANG_COOKIE, lang, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  return res;
}
