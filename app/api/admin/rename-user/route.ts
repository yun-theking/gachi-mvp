import { NextRequest, NextResponse } from "next/server";
import { userExists, renameUser } from "@/lib/questions";
import { ADMIN_COOKIE, isValidUserId } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const isAdmin = req.cookies.get(ADMIN_COOKIE)?.value === "1";
  if (!isAdmin) {
    return NextResponse.json({ error: "Admin authentication required." }, { status: 401 });
  }

  const { oldId, newId } = (await req.json()) as { oldId?: string; newId?: string };
  if (!oldId || !isValidUserId(oldId) || !newId || !isValidUserId(newId)) {
    return NextResponse.json({ error: "Both numbers must be 4 digits." }, { status: 400 });
  }
  if (oldId === newId) {
    return NextResponse.json({ error: "The new number must be different." }, { status: 400 });
  }

  const [oldExists, newTaken] = await Promise.all([userExists(oldId), userExists(newId)]);
  if (!oldExists) {
    return NextResponse.json({ error: `User '${oldId}' does not exist.` }, { status: 404 });
  }
  if (newTaken) {
    return NextResponse.json(
      { error: `Number '${newId}' is already in use by another account.` },
      { status: 409 }
    );
  }

  await renameUser(oldId, newId);
  return NextResponse.json({ ok: true });
}
