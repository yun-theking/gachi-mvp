import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getDb } from "@/lib/db";
import { ADMIN_COOKIE } from "@/lib/auth";
import { STAGE_NAMES } from "@/lib/questions";

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

const EXPORT_COLUMNS = [
  { header: "사용자 번호", key: "user_id", width: 12 },
  { header: "언어", key: "language", width: 8 },
  { header: "생애주기", key: "stage", width: 26 },
  { header: "질문(한국어)", key: "question_ko", width: 36 },
  { header: "質問(日本語)", key: "question_ja", width: 36 },
  { header: "답변(음성 원문)", key: "transcript", width: 50 },
  { header: "회고록 챕터", key: "chapter", width: 60 },
  { header: "작성일시", key: "created_at", width: 20 },
];

function addEntryRows(sheet: ExcelJS.Worksheet, rows: EntryExportRow[]) {
  sheet.columns = EXPORT_COLUMNS;
  sheet.getRow(1).font = { bold: true };

  for (const r of rows) {
    sheet.addRow({
      user_id: r.user_id,
      language: r.language === "ja" ? "日本語" : "한국어",
      stage: `${r.life_stage_id}. ${STAGE_NAMES.ko[r.life_stage_id] ?? ""}`,
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
    return NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });
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
        { error: `사용자 번호 '${userId}'의 기록이 없습니다.` },
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
    const overview = workbook.addWorksheet("전체 목록");
    overview.columns = [
      { header: "사용자 번호", key: "user_id", width: 14 },
      { header: "언어", key: "language", width: 8 },
      { header: "기록 수", key: "count", width: 10 },
    ];
    overview.getRow(1).font = { bold: true };
    for (const [uid, entries] of byUser) {
      overview.addRow({
        user_id: uid,
        language: entries[0].language === "ja" ? "日本語" : "한국어",
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
