import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/apiErrors";
import { setDataConsent } from "@/lib/questions";
import { USER_COOKIE } from "@/lib/auth";
import { DATA_CONSENT_ENABLED } from "@/lib/features";

/** Opt in or out of letting this person's answers be used to improve the service. */
export async function POST(req: NextRequest) {
  if (!DATA_CONSENT_ENABLED) return apiError("FEATURE_OFF", 404);
  const userId = req.cookies.get(USER_COOKIE)?.value;
  if (!userId) return apiError("UNAUTHORIZED", 401);
  const { consent } = (await req.json()) as { consent?: unknown };
  if (typeof consent !== "boolean") return apiError("INVALID_INPUT", 400);
  await setDataConsent(userId, consent);
  return NextResponse.json({ ok: true });
}
