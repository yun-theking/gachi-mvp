import { NextRequest, NextResponse } from "next/server";
import { registerUser, checkIpRateLimit, recordIpLoginAttempt } from "@/lib/questions";
import { USER_COOKIE, LANG_COOKIE, DEFAULT_LANG, isValidUserId, isValidLang } from "@/lib/auth";

function clientIp(req: NextRequest): string {
  // Vercel sets x-forwarded-for; fall back to a constant so local dev still works.
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || "local";
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const lock = await checkIpRateLimit(ip);
  if (lock.limited) {
    const minutes = Math.ceil((lock.retryAfterSeconds ?? 60) / 60);
    return NextResponse.json(
      { error: `너무 많이 시도했습니다. ${minutes}분 후 다시 시도해주세요.` },
      { status: 429 }
    );
  }
  await recordIpLoginAttempt(ip);

  const { userId, language } = (await req.json()) as { userId?: string; language?: string };

  if (!userId || !isValidUserId(userId)) {
    return NextResponse.json({ error: "숫자 4자리로 입력해주세요." }, { status: 400 });
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
