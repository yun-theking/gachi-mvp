import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/apiErrors";
import { setAppearance } from "@/lib/questions";
import { USER_COOKIE } from "@/lib/auth";
import { IMAGES_ENABLED } from "@/lib/features";

/** How the person looks, for consistent illustrations. Empty clears it. */
export async function POST(req: NextRequest) {
  if (!IMAGES_ENABLED) return apiError("FEATURE_OFF", 404);
  const userId = req.cookies.get(USER_COOKIE)?.value;
  if (!userId) return apiError("UNAUTHORIZED", 401);
  const { appearance } = (await req.json()) as { appearance?: unknown };
  if (typeof appearance !== "string") return apiError("INVALID_INPUT", 400);
  await setAppearance(userId, appearance);
  return NextResponse.json({ ok: true });
}
