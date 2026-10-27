/**
 * Before/after check for the memoir prompts.
 *
 * Runs each sample answer through the OLD chapter prompt and the NEW flow
 * (transcript review → chapter), then writes a side-by-side report with
 * simple automatic checks (style, length).
 *
 *   OPENAI_API_KEY=sk-... npm run eval                        # scripts/eval-samples.json
 *   OPENAI_API_KEY=sk-... npm run eval -- --xlsx export.xlsx   # answers from the admin Excel
 *
 * Output: eval-results.md (not committed).
 */
import fs from "node:fs";
import OpenAI from "openai";
import ExcelJS from "exceljs";
import { reviewPrompt, validateReview, chapterPrompt, chapterMaxTokens } from "../lib/prompts";
import type { Lang } from "../lib/auth";

interface Sample {
  label: string;
  lang: Lang;
  question: string;
  answer: string;
}

// The chapter prompt as it was before this change, for comparison.
const OLD_PROMPT: Record<Lang, (asked: string) => string> = {
  ko: (asked) => `당신은 시니어의 삶의 이야기를 아름다운 회고록으로 엮어주는 인터뷰 작가입니다.
사용자가 방금 아래 질문에 음성으로 답변했습니다.

[방금 받은 질문]
${asked}

1. chapter: 사용자의 답변을 1인칭 회고록 챕터 초안으로 작성. 한국어로, 문학적이고 따뜻한 문체로 200~400자.
2. next_question_id: null

반드시 아래 JSON 형식만 출력하세요.
{"chapter": "...", "next_question_id": null}`,
  ja: (asked) => `あなたはシニアの人生の物語を美しい回顧録に編み上げるインタビュー作家です。
ユーザーがたった今、下記の質問に音声で回答しました。

[たった今受けた質問]
${asked}

1. chapter: ユーザーの回答をもとにした一人称の回顧録の章の下書き。日本語で、文学的で温かみのある文体で200〜400字程度。
2. next_question_id: null

必ず以下のJSON形式のみを出力してください。
{"chapter": "...", "next_question_id": null}`,
};

const openai = new OpenAI();

async function chat(system: string, user: string, maxTokens: number, temperature?: number) {
  const r = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
    max_tokens: maxTokens,
    temperature,
  });
  return JSON.parse(r.choices[0].message.content ?? "{}");
}

/** Sentence endings that break the book style each language should use. */
function styleIssues(lang: Lang, text: string): string[] {
  const bad =
    lang === "ko"
      ? text.match(/[가-힣]+(습니다|습니까|해요|어요|아요|예요|이에요)[.!?]?/g)
      : text.match(/[^\s。]*(です|ます|ました|ません|でした)[。！？]?/g);
  return [...new Set(bad ?? [])].slice(0, 5);
}

async function loadSamples(): Promise<Sample[]> {
  const i = process.argv.indexOf("--xlsx");
  if (i === -1) return JSON.parse(fs.readFileSync("scripts/eval-samples.json", "utf-8"));

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(process.argv[i + 1]);
  const samples: Sample[] = [];
  wb.eachSheet((sheet) => {
    if (sheet.name === "Overview") return;
    const header = (sheet.getRow(1).values as unknown[]).map(String);
    const col = (name: string) => header.indexOf(name);
    sheet.eachRow((row, n) => {
      if (n === 1) return;
      const v = row.values as unknown[];
      const lang: Lang = String(v[col("Language")]) === "Japanese" ? "ja" : "ko";
      const answer = String(v[col("Answer (Transcript)")] ?? "").trim();
      if (!answer) return;
      samples.push({
        label: `${sheet.name} #${n - 1}`,
        lang,
        question: String(v[col(lang === "ja" ? "Question (Japanese)" : "Question (Korean)")] ?? ""),
        answer,
      });
    });
  });
  return samples.slice(0, 20);
}

async function main() {
  const samples = await loadSamples();
  console.log(`${samples.length} sample(s)`);
  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY is not set.");
    process.exit(1);
  }
  const out: string[] = ["# 회고록 프롬프트 전후 비교", ""];

  for (const s of samples) {
    console.log(`… ${s.label}`);
    const old = await chat(OLD_PROMPT[s.lang](s.question), s.answer, 1024);
    const review = validateReview(
      s.answer,
      await chat(reviewPrompt(s.lang, s.question, ""), s.answer, chapterMaxTokens(s.answer), 0)
    );
    const next = await chat(
      chapterPrompt(s.lang, { asked: s.question, recent: "", candidates: "" }),
      review.text,
      chapterMaxTokens(review.text),
      0.3
    );

    const ratio = (t: string) => (t.length / s.answer.length).toFixed(2);
    out.push(
      `## ${s.label}`,
      `**질문:** ${s.question}`,
      "",
      `**답변 (${s.answer.length}자):** ${s.answer}`,
      "",
      `**받아쓰기 검토:** 고친 부분 ${JSON.stringify(review.corrections)} / 확인 필요 ${JSON.stringify(review.uncertain)}`,
      "",
      `### 이전 (${String(old.chapter ?? "").length}자, 답변 대비 ${ratio(String(old.chapter ?? ""))}배)`,
      String(old.chapter ?? ""),
      styleIssues(s.lang, String(old.chapter ?? "")).length
        ? `\n⚠ 문체 섞임: ${styleIssues(s.lang, String(old.chapter ?? "")).join(", ")}`
        : "",
      "",
      `### 이후 (${String(next.chapter ?? "").length}자, 답변 대비 ${ratio(String(next.chapter ?? ""))}배)`,
      String(next.chapter ?? ""),
      styleIssues(s.lang, String(next.chapter ?? "")).length
        ? `\n⚠ 문체 섞임: ${styleIssues(s.lang, String(next.chapter ?? "")).join(", ")}`
        : "",
      "",
      "---",
      ""
    );
  }

  fs.writeFileSync("eval-results.md", out.join("\n"));
  console.log("→ eval-results.md");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
