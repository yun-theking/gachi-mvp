import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { password } = (await req.json()) as { password?: string };
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected) {
    return NextResponse.json(
      { error: "서버에 ADMIN_PASSWORD가 설정되어 있지 않습니다." },
      { status: 500 }
    );
  }

  if (password !== expected) {
    return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 8, // 8h session, re-enter password after that
    path: "/",
  });
  return res;
}
