import { NextRequest, NextResponse } from "next/server";
import { getAllQuestionsWithStatus } from "@/lib/questions";
import { USER_COOKIE } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const userId = req.cookies.get(USER_COOKIE)?.value;
  if (!userId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const questions = await getAllQuestionsWithStatus(userId);
  return NextResponse.json({ questions });
}
