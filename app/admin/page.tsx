import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/auth";
import AdminLoginForm from "@/components/AdminLoginForm";
import AdminUserExport from "@/components/AdminUserExport";
import AdminRenameUser from "@/components/AdminRenameUser";

export default async function AdminPage() {
  const store = await cookies();
  const isAdmin = store.get(ADMIN_COOKIE)?.value === "1";

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 py-12 px-4">
      <header className="text-center mb-2">
        <h1 className="font-serif text-2xl font-bold text-accent-dark tracking-wide">
          Admin
        </h1>
        <p className="text-xs text-text-dim mt-1">Export all user records</p>
      </header>

      {isAdmin ? (
        <div className="w-full max-w-xs flex flex-col items-center gap-6">
          <a
            href="/api/admin/export"
            className="w-full py-4 px-8 rounded-2xl bg-accent text-bg font-semibold tracking-wide text-center"
          >
            Download all data (Excel)
          </a>
          <p className="text-xs text-text-muted text-center">
            The full download is split into one tab per user.
          </p>
          <div className="w-full h-px bg-border" />
          <AdminUserExport />
          <div className="w-full h-px bg-border" />
          <AdminRenameUser />
        </div>
      ) : (
        <AdminLoginForm />
      )}
    </main>
  );
}
