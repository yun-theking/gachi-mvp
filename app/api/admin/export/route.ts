import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getDb } from "@/lib/db";
import { ADMIN_COOKIE } from "@/lib/auth";
import { stageNameEn } from "@/lib/stages";

interface EntryExportRow {
  user_id: string;
  question_id?: number | null;
  language: string;
  life_stage_id: number;
  question_ko: string;
  question_ja: string;
  transcript: string;
  chapter: string;
  created_at: string;
  recording_seconds: number | null;
  time_on_question_seconds: number | null;
  answer_chars: number | null;
}

function languageLabel(language: string): string {
  return language === "ja" ? "Japanese" : "Korean";
}

const EXPORT_COLUMNS = [
  { header: "User ID", key: "user_id", width: 12 },
  { header: "Language", key: "language", width: 10 },
  { header: "Life Stage", key: "stage", width: 40 },
  { header: "Question (Korean)", key: "question_ko", width: 36 },
  { header: "Question (Japanese)", key: "question_ja", width: 36 },
  { header: "Answer (Transcript)", key: "transcript", width: 50 },
  { header: "Memoir Chapter", key: "chapter", width: 60 },
  { header: "Created At", key: "created_at", width: 20 },
  { header: "Recording (sec)", key: "recording_seconds", width: 15 },
  { header: "Time on Question (sec)", key: "time_on_question_seconds", width: 22 },
  { header: "Answer Length (chars)", key: "answer_chars", width: 20 },
];

/** Average of the non-null values, rounded; blank when there are none
 * (e.g. answers saved before measurements were added). */
function average(values: (number | null)[]): number | "" {
  const nums = values.filter((v): v is number => v !== null && v !== undefined).map(Number);
  return nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : "";
}

function addEntryRows(sheet: ExcelJS.Worksheet, rows: EntryExportRow[]) {
  sheet.columns = EXPORT_COLUMNS;
  sheet.getRow(1).font = { bold: true };

  for (const r of rows) {
    sheet.addRow({
      user_id: r.user_id,
      language: languageLabel(r.language),
      stage: `${r.life_stage_id}. ${stageNameEn(r.life_stage_id)}`,
      question_ko: r.question_ko,
      question_ja: r.question_ja,
      transcript: r.transcript,
      chapter: r.chapter,
      created_at: r.created_at,
      recording_seconds: r.recording_seconds ?? "",
      time_on_question_seconds: r.time_on_question_seconds ?? "",
      answer_chars: r.answer_chars ?? "",
    });
  }

  sheet.eachRow((row) => {
    row.alignment = { vertical: "top", wrapText: true };
  });
}

/** Excel sheet names: max 31 chars, and none of : \ / ? * [ ] allowed.
 * User IDs are numeric-only today, but this keeps tab creation safe if that
 * ever changes (e.g. provider-based IDs from a future social login). */
function sheetNameFor(userId: string): string {
  return userId.replace(/[:\\/?*[\]]/g, "_").slice(0, 31) || "user";
}

export async function GET(req: NextRequest) {
  const isAdmin = req.cookies.get(ADMIN_COOKIE)?.value === "1";
  if (!isAdmin) {
    return NextResponse.json({ error: "Admin authentication required." }, { status: 401 });
  }

  const userId = req.nextUrl.searchParams.get("userId")?.trim();

  const db = await getDb();

  const workbook = new ExcelJS.Workbook();
  let filename: string;

  if (userId) {
    // Single-user download: one sheet, this user only.
    const result = await db.execute({
      sql: `SELECT e.user_id, COALESCE(u.language, 'ko') as language, e.life_stage_id,
                   e.question_ko, e.question_ja, e.transcript, e.chapter, e.created_at,
                   e.recording_seconds, e.time_on_question_seconds, e.answer_chars
            FROM entries e
            LEFT JOIN users u ON u.id = e.user_id
            WHERE e.user_id = ?
            ORDER BY e.life_stage_id, e.id`,
      args: [userId],
    });
    const rows = result.rows as unknown as EntryExportRow[];

    if (rows.length === 0) {
      return NextResponse.json(
        { error: `No records found for user '${userId}'.` },
        { status: 404 }
      );
    }

    addEntryRows(workbook.addWorksheet(sheetNameFor(userId)), rows);
    filename = `gachi-entries-${userId}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  } else {
    // Full download: one tab per user, so a reader can jump straight to one
    // person instead of scrolling through everyone in a single flat sheet.
    const result = await db.execute(
      `SELECT e.user_id, COALESCE(u.language, 'ko') as language, e.life_stage_id, e.question_id,
              e.question_ko, e.question_ja, e.transcript, e.chapter, e.created_at,
              e.recording_seconds, e.time_on_question_seconds, e.answer_chars
       FROM entries e
       LEFT JOIN users u ON u.id = e.user_id
       ORDER BY e.user_id, e.life_stage_id, e.id`
    );
    const rows = result.rows as unknown as EntryExportRow[];

    const byUser = new Map<string, EntryExportRow[]>();
    for (const r of rows) {
      const list = byUser.get(r.user_id);
      if (list) list.push(r);
      else byUser.set(r.user_id, [r]);
    }

    // Overview tab first so the admin has a jump-off point before the
    // per-user tabs: who's in this export, plus per-person averages.
    const overview = workbook.addWorksheet("Overview");
    overview.columns = [
      { header: "User ID", key: "user_id", width: 14 },
      { header: "Language", key: "language", width: 10 },
      { header: "Entry Count", key: "count", width: 12 },
      { header: "Avg Recording (sec)", key: "avg_recording", width: 20 },
      { header: "Avg Time on Question (sec)", key: "avg_time", width: 26 },
      { header: "Avg Answer Length (chars)", key: "avg_chars", width: 24 },
    ];
    overview.getRow(1).font = { bold: true };
    for (const [uid, entries] of byUser) {
      overview.addRow({
        user_id: uid,
        language: languageLabel(entries[0].language),
        count: entries.length,
        avg_recording: average(entries.map((e) => e.recording_seconds)),
        avg_time: average(entries.map((e) => e.time_on_question_seconds)),
        avg_chars: average(entries.map((e) => e.answer_chars)),
      });
    }

    // Per-question averages across everyone: which questions take long,
    // get short answers, or are rarely answered — for deciding how many
    // questions to keep and which to reword.
    const perQuestion = workbook.addWorksheet("Per Question");
    perQuestion.columns = [
      { header: "Question ID", key: "question_id", width: 12 },
      { header: "Question (Korean)", key: "question_ko", width: 50 },
      { header: "Answers", key: "answers", width: 10 },
      { header: "Avg Recording (sec)", key: "avg_recording", width: 20 },
      { header: "Avg Time on Question (sec)", key: "avg_time", width: 26 },
      { header: "Avg Answer Length (chars)", key: "avg_chars", width: 24 },
    ];
    perQuestion.getRow(1).font = { bold: true };
    const byQuestion = new Map<string, EntryExportRow[]>();
    for (const r of rows) {
      const key = String(r.question_id ?? "");
      if (!key) continue;
      const list = byQuestion.get(key);
      if (list) list.push(r);
      else byQuestion.set(key, [r]);
    }
    for (const [qid, list] of [...byQuestion].sort(([a], [b]) => Number(a) - Number(b))) {
      perQuestion.addRow({
        question_id: Number(qid),
        question_ko: list[0].question_ko,
        answers: list.length,
        avg_recording: average(list.map((e) => e.recording_seconds)),
        avg_time: average(list.map((e) => e.time_on_question_seconds)),
        avg_chars: average(list.map((e) => e.answer_chars)),
      });
    }
    perQuestion.eachRow((row) => {
      row.alignment = { vertical: "top", wrapText: true };
    });

    for (const [uid, entries] of byUser) {
      addEntryRows(workbook.addWorksheet(sheetNameFor(uid)), entries);
    }

    filename = `gachi-entries-all-${new Date().toISOString().slice(0, 10)}.xlsx`;
  }

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
