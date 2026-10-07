import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/apiErrors";
import { markOnboardingSeen } from "@/lib/questions";
import { USER_COOKIE } from "@/lib/auth";

/** Marks the tutorial as seen (finished or skipped) for this account. */
export async function POST(req: NextRequest) {
  const userId = req.cookies.get(USER_COOKIE)?.value;
  if (!userId) return apiError("UNAUTHORIZED", 401);
  await markOnboardingSeen(userId);
  return NextResponse.json({ ok: true });
}
