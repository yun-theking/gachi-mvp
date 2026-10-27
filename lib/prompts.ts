import type { Lang } from "./auth";

/**
 * AI prompts for turning a spoken answer into a memoir chapter, plus the
 * checks applied to what the model returns. Kept free of OpenAI/DB imports
 * so the rules can be unit-tested and reused by scripts/eval-prompts.ts.
 *
 * Two steps per answer:
 * 1. Transcript review (right after speech-to-text): fix words that were
 *    obviously mis-recognised, and flag ones that look wrong but can't be
 *    fixed with confidence. The person then confirms or edits the text.
 * 2. Chapter writing (after the person confirms): write ONLY what they
 *    said, plainly, in one consistent book style, at a length that matches
 *    how much they said.
 */

// ── Step 1: transcript review ───────────────────────────────────────────────

export interface TranscriptReview {
  /** Transcript with obvious recognition errors fixed. */
  text: string;
  /** What was changed, so the person can see it. */
  corrections: { from: string; to: string }[];
  /** Words that look mis-recognised but couldn't be fixed confidently. */
  uncertain: string[];
}

const REVIEW_PROMPTS: Record<Lang, (question: string, field: string) => string> = {
  ko: (question, field) => `당신은 음성 인식 결과를 검토하는 교정자입니다.
아래 텍스트는 어르신이 인터뷰 질문에 말로 답한 것을 음성 인식(STT)으로 받아쓴 것입니다. 음성 인식이 단어를 잘못 알아들었을 수 있습니다.

[질문]
${question}
${field ? `\n[답변자의 직업·경험 분야]\n${field}\n` : ""}
할 일:
1. 문맥상 잘못 인식된 것이 명백하고, 원래 단어를 확신할 수 있는 경우에만 고치세요.
   예: 약국 이야기 중 "페의학사로 일했다" → "페이약사로 일했다"
2. 잘못 인식된 것 같지만 원래 단어를 확신할 수 없으면 고치지 말고 uncertain에 그 단어를 그대로 넣으세요.
3. 그 밖의 모든 내용은 그대로 두세요. 요약, 다듬기, 순서 변경, 내용 추가, 사투리·말버릇 수정을 하지 마세요. 문장부호만 자연스럽게 넣어도 됩니다.

JSON만 출력하세요:
{"text": "고친 전체 텍스트", "corrections": [{"from": "원래 단어", "to": "고친 단어"}], "uncertain": ["확인이 필요한 단어"]}`,

  ja: (question, field) => `あなたは音声認識の結果を確認する校正者です。
以下のテキストは、高齢の方がインタビューの質問に口頭で答えた内容を音声認識（STT）で書き起こしたものです。音声認識が言葉を聞き間違えている可能性があります。

[質問]
${question}
${field ? `\n[回答者の職業・経験分野]\n${field}\n` : ""}
やること:
1. 文脈から聞き間違いが明らかで、本来の言葉に確信が持てる場合のみ修正してください。
2. 聞き間違いのようでも本来の言葉に確信が持てない場合は修正せず、その語をそのまま uncertain に入れてください。
3. それ以外はすべてそのままにしてください。要約・言い換え・順序の変更・内容の追加・方言や口癖の修正はしないでください。句読点を自然に補うことだけは構いません。

JSONのみを出力してください:
{"text": "修正後の全文", "corrections": [{"from": "元の語", "to": "修正後の語"}], "uncertain": ["確認が必要な語"]}`,
};

export function reviewPrompt(lang: Lang, question: string, field: string): string {
  return REVIEW_PROMPTS[lang](question, field);
}

/**
 * Sanity-checks the model's review before showing it. Falls back to the raw
 * transcript whenever the model did more than fix words (e.g. shortened or
 * rewrote the answer), and drops corrections/flags that don't match the text.
 */
export function validateReview(raw: string, parsed: unknown): TranscriptReview {
  const fallback: TranscriptReview = { text: raw, corrections: [], uncertain: [] };
  if (!parsed || typeof parsed !== "object") return fallback;
  const p = parsed as Record<string, unknown>;
  const text = typeof p.text === "string" ? p.text.trim() : "";
  if (!text) return fallback;

  // Word fixes and punctuation barely change the length; a big change means
  // the model summarised or rewrote instead.
  const ratio = text.length / Math.max(raw.trim().length, 1);
  if (ratio < 0.8 || ratio > 1.25) return fallback;

  const corrections = Array.isArray(p.corrections)
    ? p.corrections
        .filter(
          (c): c is { from: string; to: string } =>
            !!c &&
            typeof (c as { from?: unknown }).from === "string" &&
            typeof (c as { to?: unknown }).to === "string"
        )
        .filter((c) => c.from.trim() && c.to.trim() && c.from !== c.to && text.includes(c.to))
        .slice(0, 10)
    : [];

  const uncertain = Array.isArray(p.uncertain)
    ? [...new Set(p.uncertain.filter((u): u is string => typeof u === "string" && !!u.trim()))]
        .filter((u) => text.includes(u))
        .slice(0, 5)
    : [];

  return { text, corrections, uncertain };
}

// ── Step 2: chapter writing ────────────────────────────────────────────────

const CHAPTER_PROMPTS: Record<
  Lang,
  (q: { asked: string; recent: string; candidates: string }) => string
> = {
  ko: ({ asked, recent, candidates }) => `당신은 어르신이 말로 들려준 이야기를 자서전 원고로 옮기는 편집자입니다.
가장 중요한 원칙은 사실에 충실한 것입니다. 글을 풍부하게 만드는 것보다 말한 내용을 정확하게 담는 것이 우선입니다.

[방금 받은 질문]
${asked}

[최근 답변 기록 (오래된 순) — 다음 질문을 고를 때만 참고]
${recent || "(아직 없음)"}

두 가지를 JSON으로 반환하세요.

1. chapter: 이번 답변을 자서전 원고로 옮긴 글
   - 사용자가 이번 답변에서 실제로 말한 내용만 쓰세요. 말하지 않은 사건, 인물, 장소, 날짜, 숫자, 감정, 대화, 교훈을 지어내거나 추측해서 넣지 마세요.
   - 최근 답변 기록의 내용을 이번 글에 가져오지 마세요.
   - 할 수 있는 것: 말버릇·반복·군더더기 빼기, 순서 정리, 문장 다듬기, 문장 잇기.
   - 문체: 책에 쓰는 "~했다", "~였다" 평서체로 통일하세요. "~했습니다", "~해요"를 섞지 마세요. 1인칭은 "나"를 쓰세요.
   - 담백하게 쓰세요. 화려한 비유, 과장, 감상적인 꾸밈, 말하지 않은 마무리 교훈을 넣지 마세요.
   - 길이는 답변의 양에 맞추세요. 짧게 답했으면 한두 문장으로 짧게, 길게 답했으면 세부 내용을 빠뜨리지 말고 모두 담으세요. 분량을 채우려고 늘리지 마세요.
2. next_question_id: 아래 후보 중 지금까지의 흐름상 다음으로 묻기에 가장 자연스러운 질문의 id 하나. 후보 목록의 id만 고르고, 질문 문구를 새로 짓지 마세요.

[다음 질문 후보]
${candidates || "(후보가 없습니다. next_question_id는 null로 응답하세요.)"}

JSON만 출력하세요:
{"chapter": "...", "next_question_id": <숫자 또는 null>}`,

  ja: ({ asked, recent, candidates }) => `あなたは、高齢の方が口頭で語った話を自分史の原稿にまとめる編集者です。
最も大切な原則は事実に忠実であることです。文章を豊かにすることより、語られた内容を正確に残すことを優先してください。

[たった今受けた質問]
${asked}

[最近の回答履歴（古い順）— 次の質問を選ぶときだけ参考にする]
${recent || "（まだありません）"}

次の2つをJSONで返してください。

1. chapter: 今回の回答を自分史の原稿にした文章
   - 今回の回答で実際に語られた内容だけを書いてください。語られていない出来事・人物・場所・日付・数字・感情・会話・教訓を創作したり推測で加えたりしないでください。
   - 最近の回答履歴の内容を今回の文章に持ち込まないでください。
   - してよいこと：口癖・繰り返し・言いよどみを省く、順序を整える、文を整える、文をつなぐ。
   - 文体：「〜した」「〜だった」「〜である」のだ・である調（常体）で統一してください。です・ます調を混ぜないでください。一人称は「私」を使ってください。
   - 淡々と書いてください。華やかな比喩、誇張、感傷的な装飾、語られていない締めくくりの教訓は入れないでください。
   - 長さは回答の量に合わせてください。短い回答なら1〜2文で短く、長い回答なら細部を落とさずすべて含めてください。分量を埋めるために膨らませないでください。
2. next_question_id: 下記の候補から、これまでの流れで次に尋ねるのに最も自然な質問のidを1つ。候補リストのidだけを選び、質問文を新しく作らないでください。

[次の質問候補]
${candidates || "（候補がありません。next_question_idはnullで応答してください。）"}

JSONのみを出力してください:
{"chapter": "...", "next_question_id": <数値またはnull>}`,
};

export function chapterPrompt(
  lang: Lang,
  q: { asked: string; recent: string; candidates: string }
): string {
  return CHAPTER_PROMPTS[lang](q);
}

/**
 * Output budget that grows with the answer, so a long answer is never cut
 * off mid-sentence (a fixed limit used to truncate them). Korean/Japanese
 * run at most about one token per character; the extra covers JSON and the
 * chosen question id.
 */
export function chapterMaxTokens(answer: string): number {
  return Math.min(4000, 300 + Math.ceil(answer.length * 1.5));
}
