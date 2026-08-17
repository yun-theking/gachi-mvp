import { NextRequest, NextResponse } from "next/server";
import { registerUser } from "@/lib/questions";
import { USER_COOKIE, isValidUserId } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { userId } = (await req.json()) as { userId?: string };

  if (!userId || !isValidUserId(userId)) {
    return NextResponse.json(
      { error: "숫자로만 1~10자리 입력해주세요." },
      { status: 400 }
    );
  }

  await registerUser(userId);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(USER_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  return res;
}
