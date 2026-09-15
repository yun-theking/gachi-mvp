import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getDb } from "@/lib/db";
import { ADMIN_COOKIE } from "@/lib/auth";

interface EntryExportRow {
  user_id: string;
  language: string;
  life_stage_id: number;
  question_ko: string;
  question_ja: string;
  transcript: string;
  chapter: string;
  created_at: string;
}

/** English labels for the life-stage column. Kept local to the export route
 * (rather than added to STAGE_NAMES) since the in-app STAGE_NAMES map only
 * covers the languages the product UI itself supports (ko/ja); this export
 * is admin-facing and English-based regardless of the user's app language. */
const STAGE_NAMES_EN: Record<number, string> = {
  1: "Childhood & Upbringing",
  2: "School Days & Early Youth",
  3: "Early Career: First Job / Startup",
  4: "Growth-Stage Career: Challenges & Failures",
  5: "Peak Years: Leadership & Decisions",
  6: "Crisis & Hardship: Overcoming",
  7: "Relationships: Mentors & Colleagues",
  8: "Family: Marriage & Personal Life",
  9: "Values & Life Philosophy",
  10: "After Retirement: Words for the Next Generation",
};

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
];

function addEntryRows(sheet: ExcelJS.Worksheet, rows: EntryExportRow[]) {
  sheet.columns = EXPORT_COLUMNS;
  sheet.getRow(1).font = { bold: true };

  for (const r of rows) {
    sheet.addRow({
      user_id: r.user_id,
      language: languageLabel(r.language),
      stage: `${r.life_stage_id}. ${STAGE_NAMES_EN[r.life_stage_id] ?? ""}`,
      question_ko: r.question_ko,
      question_ja: r.question_ja,
      transcript: r.transcript,
      chapter: r.chapter,
      created_at: r.created_at,
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
                   e.question_ko, e.question_ja, e.transcript, e.chapter, e.created_at
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
      `SELECT e.user_id, COALESCE(u.language, 'ko') as language, e.life_stage_id,
              e.question_ko, e.question_ja, e.transcript, e.chapter, e.created_at
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
    // per-user tabs. Kept minimal — just who's in this export.
    const overview = workbook.addWorksheet("Overview");
    overview.columns = [
      { header: "User ID", key: "user_id", width: 14 },
      { header: "Language", key: "language", width: 10 },
      { header: "Entry Count", key: "count", width: 12 },
    ];
    overview.getRow(1).font = { bold: true };
    for (const [uid, entries] of byUser) {
      overview.addRow({
        user_id: uid,
        language: languageLabel(entries[0].language),
        count: entries.length,
      });
    }

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
