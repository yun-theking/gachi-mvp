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

export async function GET(req: NextRequest) {
  const isAdmin = req.cookies.get(ADMIN_COOKIE)?.value === "1";
  if (!isAdmin) {
    return NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });
  }

  const db = await getDb();
  const result = await db.execute(
    `SELECT e.user_id, COALESCE(u.language, 'ko') as language, e.life_stage_id,
            e.question_ko, e.question_ja, e.transcript, e.chapter, e.created_at
     FROM entries e
     LEFT JOIN users u ON u.id = e.user_id
     ORDER BY e.user_id, e.life_stage_id, e.id`
  );
  const rows = result.rows as unknown as EntryExportRow[];

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("entries");

  sheet.columns = [
    { header: "사용자 번호", key: "user_id", width: 12 },
    { header: "언어", key: "language", width: 8 },
    { header: "생애주기", key: "stage", width: 26 },
    { header: "질문(한국어)", key: "question_ko", width: 36 },
    { header: "質問(日本語)", key: "question_ja", width: 36 },
    { header: "답변(음성 원문)", key: "transcript", width: 50 },
    { header: "회고록 챕터", key: "chapter", width: 60 },
    { header: "작성일시", key: "created_at", width: 20 },
  ];
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

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `gachi-entries-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
