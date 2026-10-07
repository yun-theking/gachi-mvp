import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/apiErrors";
import { getAllQuestionsWithStatus } from "@/lib/questions";
import { USER_COOKIE } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const userId = req.cookies.get(USER_COOKIE)?.value;
  if (!userId) {
    return apiError("UNAUTHORIZED", 401);
  }

  const questions = await getAllQuestionsWithStatus(userId);
  return NextResponse.json({ questions });
}
