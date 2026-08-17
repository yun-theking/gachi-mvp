import { cookies } from "next/headers";
import { getAllEntries, getProgressSummary, TOTAL_STAGES, STAGE_NAMES } from "@/lib/questions";
import { USER_COOKIE } from "@/lib/auth";
import ChapterPanel from "@/components/ChapterPanel";

export default async function ArchivePage() {
  const store = await cookies();
  const userId = store.get(USER_COOKIE)?.value;

  // middleware already guarantees this, but keep the page safe on its own too
  if (!userId) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <p className="text-text-dim text-sm">로그인이 필요합니다.</p>
      </main>
    );
  }

  const entries = await getAllEntries(userId);
  const progress = await getProgressSummary(userId);
  const stagesStarted = new Set(entries.map((e) => e.life_stage_id)).size;

  const byStage = new Map<number, typeof entries>();
  for (const entry of entries) {
    const list = byStage.get(entry.life_stage_id) ?? [];
    list.push(entry);
    byStage.set(entry.life_stage_id, list);
  }

  return (
    <main className="min-h-screen flex flex-col items-center gap-8 py-12 px-4">
      <header className="text-center mb-2">
        <h1 className="font-serif text-3xl font-bold text-gold-light tracking-wide mb-2">
          내 회고록
        </h1>
        <p className="text-xs text-text-dim tracking-widest uppercase">
          {progress.totalAnswered}/{progress.totalQuestions} 질문 답변 완료 ·{" "}
          {stagesStarted}/{TOTAL_STAGES} 생애주기 진행중
        </p>
      </header>

      {entries.length === 0 ? (
        <div className="w-full max-w-xl bg-surface border border-border rounded-2xl p-10 text-center">
          <p className="text-text-dim text-sm">
            아직 남긴 이야기가 없어요. 인터뷰 페이지에서 첫 질문에 답해보세요.
          </p>
        </div>
      ) : (
        <div className="w-full max-w-xl flex flex-col gap-10">
          {Array.from({ length: TOTAL_STAGES }, (_, i) => i + 1)
            .filter((stageId) => byStage.has(stageId))
            .map((stageId) => (
              <section key={stageId} className="flex flex-col gap-4">
                <h2 className="font-serif text-lg text-gold-light border-b border-border pb-2">
                  {stageId}. {STAGE_NAMES[stageId]}
                </h2>
                {byStage.get(stageId)!.map((entry) => (
                  <ChapterPanel
                    key={entry.id}
                    label={new Date(entry.created_at).toLocaleDateString("ko-KR")}
                    questionKo={entry.question_ko}
                    chapter={entry.chapter}
                  />
                ))}
              </section>
            ))}
        </div>
      )}
    </main>
  );
}
