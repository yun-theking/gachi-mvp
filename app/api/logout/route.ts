import { NextResponse } from "next/server";
import { USER_COOKIE, LANG_COOKIE } from "@/lib/auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(USER_COOKIE);
  res.cookies.delete(LANG_COOKIE);
  return res;
}
