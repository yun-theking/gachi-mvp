import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/auth";
import AdminLoginForm from "@/components/AdminLoginForm";
import AdminUserExport from "@/components/AdminUserExport";

export default async function AdminPage() {
  const store = await cookies();
  const isAdmin = store.get(ADMIN_COOKIE)?.value === "1";

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 py-12 px-4">
      <header className="text-center mb-2">
        <h1 className="font-serif text-2xl font-bold text-accent-dark tracking-wide">
          관리자
        </h1>
        <p className="text-xs text-text-dim mt-1">전체 사용자 기록 내보내기</p>
      </header>

      {isAdmin ? (
        <div className="w-full max-w-xs flex flex-col items-center gap-6">
          <a
            href="/api/admin/export"
            className="w-full py-4 px-8 rounded-2xl bg-accent text-bg font-semibold tracking-wide text-center"
          >
            전체 데이터 엑셀 다운로드
          </a>
          <p className="text-xs text-text-muted text-center">
            전체 다운로드는 사용자별로 탭이 나뉘어 있습니다.
          </p>
          <div className="w-full h-px bg-border" />
          <AdminUserExport />
        </div>
      ) : (
        <AdminLoginForm />
      )}
    </main>
  );
}
