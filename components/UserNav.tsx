import { cookies } from "next/headers";
import { USER_COOKIE } from "@/lib/auth";
import LogoutButton from "./LogoutButton";

export default async function UserNav() {
  const store = await cookies();
  const uid = store.get(USER_COOKIE)?.value;
  if (!uid) return null;

  return (
    <div className="flex items-center gap-4">
      <span>번호 {uid}</span>
      <LogoutButton />
    </div>
  );
}
