import { cookies } from "next/headers";
import { getAllEntries, getProgressSummary, TOTAL_STAGES, STAGE_NAMES } from "@/lib/questions";
import { USER_COOKIE, LANG_COOKIE, DEFAULT_LANG, isValidLang } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import ChapterPanel from "@/components/ChapterPanel";

export default async function ArchivePage() {
  const store = await cookies();
  const userId = store.get(USER_COOKIE)?.value;
  const langCookie = store.get(LANG_COOKIE)?.value;
  const lang = isValidLang(langCookie) ? langCookie : DEFAULT_LANG;
  const t = getDict(lang);

  // middleware already guarantees this, but keep the page safe on its own too
  if (!userId) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <p className="text-text-dim text-sm">Login required.</p>
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

  const dateLocale = lang === "ja" ? "ja-JP" : "ko-KR";

  return (
    <main className="min-h-screen flex flex-col items-center gap-8 py-8 px-4">
      <p className="text-xs text-text-dim tracking-widest uppercase text-center">
        {t.archiveProgress(progress.totalAnswered, progress.totalQuestions, stagesStarted, TOTAL_STAGES)}
      </p>

      {entries.length === 0 ? (
        <div className="w-full max-w-xl bg-surface border border-border rounded-2xl p-10 text-center">
          <p className="text-text-dim text-sm">{t.archiveEmpty}</p>
        </div>
      ) : (
        <div className="w-full max-w-xl flex flex-col gap-10">
          {Array.from({ length: TOTAL_STAGES }, (_, i) => i + 1)
            .filter((stageId) => byStage.has(stageId))
            .map((stageId) => (
              <section key={stageId} className="flex flex-col gap-4">
                <h2 className="font-serif text-lg text-accent-dark border-b border-border pb-2">
                  {stageId}. {STAGE_NAMES[lang][stageId]}
                </h2>
                {byStage.get(stageId)!.map((entry) => (
                  <ChapterPanel
                    key={entry.id}
                    label={new Date(entry.created_at).toLocaleDateString(dateLocale)}
                    questionKo={lang === "ja" ? entry.question_ja || entry.question_ko : entry.question_ko}
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
