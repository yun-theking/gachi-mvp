import { cookies } from "next/headers";
import { USER_COOKIE } from "@/lib/auth";
import { getUserFields } from "@/lib/questions";
import FieldPicker from "@/components/FieldPicker";

export default async function FieldsPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const store = await cookies();
  const userId = store.get(USER_COOKIE)?.value;
  const initial = userId ? await getUserFields(userId) : null;
  const { next } = await searchParams;
  // Only same-site paths, so ?next= can't bounce people to another site.
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  return <FieldPicker initialFields={initial ?? []} next={safeNext} firstTime={initial === null} />;
}
