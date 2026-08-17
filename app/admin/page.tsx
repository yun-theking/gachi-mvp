import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/auth";
import AdminLoginForm from "@/components/AdminLoginForm";

export default async function AdminPage() {
  const store = await cookies();
  const isAdmin = store.get(ADMIN_COOKIE)?.value === "1";

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 py-12 px-4">
      <header className="text-center mb-2">
        <h1 className="font-serif text-2xl font-bold text-gold-light tracking-wide">
          관리자
        </h1>
        <p className="text-xs text-text-dim mt-1">전체 사용자 기록 내보내기</p>
      </header>

      {isAdmin ? (
        <a
          href="/api/admin/export"
          className="py-4 px-8 rounded-2xl bg-gold text-bg font-semibold tracking-wide text-center"
        >
          전체 데이터 엑셀 다운로드
        </a>
      ) : (
        <AdminLoginForm />
      )}
    </main>
  );
}
