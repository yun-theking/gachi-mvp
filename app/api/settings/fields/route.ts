import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/apiErrors";
import { getUserFields, setUserFields } from "@/lib/questions";
import { isValidFieldCode } from "@/lib/stages";
import { USER_COOKIE } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const userId = req.cookies.get(USER_COOKIE)?.value;
  if (!userId) return apiError("UNAUTHORIZED", 401);
  return NextResponse.json({ fields: await getUserFields(userId) });
}

/** Saves the person's occupation/experience fields. An empty list is valid
 * ("none of these"): it only shows the common questions. */
export async function POST(req: NextRequest) {
  const userId = req.cookies.get(USER_COOKIE)?.value;
  if (!userId) return apiError("UNAUTHORIZED", 401);

  const { fields } = (await req.json()) as { fields?: unknown };
  if (!Array.isArray(fields) || !fields.every(isValidFieldCode)) {
    return apiError("INVALID_INPUT", 400);
  }

  await setUserFields(userId, fields);
  return NextResponse.json({ ok: true });
}
