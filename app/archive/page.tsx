import { cookies } from "next/headers";
import { getAllEntries, getProgressSummary, getSectionProgress, getStreakDays } from "@/lib/questions";
import { SECTIONS, stageHeading } from "@/lib/stages";
import { USER_COOKIE, LANG_COOKIE, DEFAULT_LANG, isValidLang } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import ChapterPanel from "@/components/ChapterPanel";
import { IconCheck } from "@/components/icons";

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
        <p className="text-text-dim text-base">Login required.</p>
      </main>
    );
  }

  const entries = await getAllEntries(userId);
  const progress = await getProgressSummary(userId);
  const sections = await getSectionProgress(userId);
  const streakDays = await getStreakDays(userId);
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
      <p className="text-base text-text-dim text-center">
        {t.archiveProgress(progress.totalAnswered, progress.totalQuestions, stagesStarted, progress.totalStages)}
      </p>

      {streakDays >= 2 && (
        <p className="-mt-4 text-sm font-semibold text-accent-dark text-center">{t.streakLabel(streakDays)}</p>
      )}

      {/* Table of contents: each section is a chapter of the book, marked
          complete once every question in it has an answer. */}
      <nav aria-label={t.bookTitle} className="w-full max-w-xl bg-surface border border-border rounded-2xl p-5">
        <h2 className="font-serif text-lg font-bold text-text mb-3">{t.bookTitle}</h2>
        <ol className="flex flex-col">
          {sections.map(({ stageId, answered, total }) => {
            const done = total > 0 && answered === total;
            const label = stageHeading(lang, stageId);
            const content = (
              <>
                <span className={`flex-1 text-base ${answered > 0 ? "text-text" : "text-text-muted"}`}>{label}</span>
                {done ? (
                  <span className="flex items-center gap-1 text-sm font-bold text-white bg-accent rounded-full px-2.5 py-0.5">
                    <IconCheck className="w-3.5 h-3.5" />
                    {t.bookStageDone}
                  </span>
                ) : (
                  <span className="text-sm tabular-nums text-text-dim">
                    {answered}/{total}
                  </span>
                )}
              </>
            );
            return (
              <li key={stageId} className="border-b border-border last:border-0">
                {byStage.has(stageId) ? (
                  <a href={`#stage-${stageId}`} className="flex items-center gap-3 py-3 min-h-[44px]">
                    {content}
                  </a>
                ) : (
                  <div className="flex items-center gap-3 py-3 min-h-[44px]">{content}</div>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {entries.length === 0 ? (
        <div className="w-full max-w-xl bg-surface border border-border rounded-2xl p-10 text-center">
          <p className="text-text-dim text-base">{t.archiveEmpty}</p>
        </div>
      ) : (
        <div className="w-full max-w-xl flex flex-col gap-10">
          {SECTIONS.map((s) => s.id)
            .filter((stageId) => byStage.has(stageId))
            .map((stageId) => (
              <section key={stageId} id={`stage-${stageId}`} className="flex flex-col gap-4 scroll-mt-20">
                <h2 className="font-serif text-lg text-accent-dark border-b border-border pb-2">
                  {stageHeading(lang, stageId)}
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
