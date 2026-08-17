import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import {
  getQuestionById,
  getCurrentStageId,
  getRemainingQuestions,
  saveEntry,
  getProgressSummary,
  getStagePosition,
} from "@/lib/questions";
import { USER_COOKIE, LANG_COOKIE, DEFAULT_LANG, isValidLang, type Lang } from "@/lib/auth";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const PROMPTS: Record<
  Lang,
  { instructions: (askedText: string, candidateList: string) => string; noAnswerText: string }
> = {
  ko: {
    noAnswerText: "(자유 답변)",
    instructions: (askedText, candidateList) => `당신은 시니어의 삶의 이야기를 아름다운 회고록으로 엮어주는 인터뷰 작가입니다.
사용자가 방금 아래 질문에 음성으로 답변했습니다.

[방금 받은 질문]
${askedText}

이 답변을 바탕으로 두 가지를 JSON으로 반환하세요.

1. chapter: 사용자의 답변을 1인칭 회고록 챕터 초안으로 작성. 한국어로, 문학적이고 따뜻한 문체로 200~400자.
2. next_question_id: 아래 후보 질문 목록 중, 지금까지의 대화 흐름상 다음으로 묻기에 가장 자연스러운 질문의 id 하나.
   반드시 후보 목록에 있는 id 중 하나만 그대로 선택하세요. 질문 문구를 새로 짓거나 바꾸지 마세요.

[다음 질문 후보]
${candidateList || "(이 생애주기의 후보가 모두 소진되었습니다. next_question_id는 null로 응답하세요.)"}

반드시 아래 JSON 형식만 출력하세요. 다른 텍스트는 절대 포함하지 마세요.
{"chapter": "...", "next_question_id": <숫자 또는 null>}`,
  },
  ja: {
    noAnswerText: "（自由回答）",
    instructions: (askedText, candidateList) => `あなたはシニアの人生の物語を美しい回顧録に編み上げるインタビュー作家です。
ユーザーがたった今、下記の質問に音声で回答しました。

[たった今受けた質問]
${askedText}

この回答をもとに、次の2つをJSONで返してください。

1. chapter: ユーザーの回答をもとにした一人称の回顧録の章の下書き。日本語で、文学的で温かみのある文体で200〜400字程度。
2. next_question_id: 下記の候補質問リストの中から、これまでの会話の流れ上、次に尋ねるのに最も自然な質問のidを1つ選んでください。
   必ず候補リストにあるidの中から1つをそのまま選んでください。質問文を新しく作ったり変更したりしないでください。

[次の質問候補]
${candidateList || "（このライフステージの候補はすべて消化されました。next_question_idはnullで応答してください。）"}

必ず以下のJSON形式のみを出力してください。他のテキストは一切含めないでください。
{"chapter": "...", "next_question_id": <数値またはnull>}`,
  },
};

export async function POST(req: NextRequest) {
  try {
    const userId = req.cookies.get(USER_COOKIE)?.value;
    if (!userId) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    const langCookie = req.cookies.get(LANG_COOKIE)?.value;
    const lang: Lang = isValidLang(langCookie) ? langCookie : DEFAULT_LANG;

    const { text, questionId, history } = (await req.json()) as {
      text: string;
      questionId?: number;
      history?: { role: "user" | "assistant"; content: string }[];
    };

    if (!text?.trim()) {
      return NextResponse.json({ error: "텍스트가 없습니다." }, { status: 400 });
    }

    const askedQuestion = questionId ? await getQuestionById(questionId) : undefined;
    const lifeStageId =
      askedQuestion?.life_stage_id ?? (await getCurrentStageId(userId)) ?? 1;

    const prompt = PROMPTS[lang];
    const askedKo = askedQuestion?.question_ko ?? prompt.noAnswerText;
    const askedJa = askedQuestion?.question_ja ?? prompt.noAnswerText;
    const askedText = lang === "ja" ? askedJa : askedKo;

    const stageBefore = await getCurrentStageId(userId);

    // Candidates for the *next* question: remaining questions in the same stage,
    // excluding the one the user just answered. The model may only pick from this list —
    // it never invents question text itself.
    const stageCandidates = (await getRemainingQuestions(userId, lifeStageId)).filter(
      (q) => q.id !== questionId
    );
    const candidateList = stageCandidates
      .map((q) => `- id:${q.id} "${lang === "ja" ? q.question_ja : q.question_ko}"`)
      .join("\n");

    const systemPrompt = prompt.instructions(askedText, candidateList);

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
    ];

    if (history && history.length > 0) {
      for (const msg of history.slice(-8)) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    messages.push({ role: "user", content: text });

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      response_format: { type: "json_object" },
      max_tokens: 1024,
    });

    const raw = response.choices[0].message.content ?? "{}";
    const parsed = JSON.parse(raw) as {
      chapter: string;
      next_question_id: number | null;
    };

    // Persist this turn now that we have the generated chapter. Store both
    // language versions of the question text regardless of which language
    // the person is using, so switching languages later still shows correctly.
    await saveEntry({
      userId,
      questionId: askedQuestion?.id ?? null,
      lifeStageId,
      questionKo: askedKo,
      questionJa: askedJa,
      transcript: text,
      chapter: parsed.chapter,
    });

    // Resolve the actual next question. Recompute *after* saving, since saving just
    // consumed one question from the pool and may have advanced the stage.
    const stageAfter = await getCurrentStageId(userId);
    let nextQuestion = null;
    if (stageAfter !== null) {
      const pool = await getRemainingQuestions(userId, stageAfter);
      nextQuestion =
        pool.find((q) => q.id === parsed.next_question_id) ?? pool[0] ?? null;
    }

    return NextResponse.json({
      chapter: parsed.chapter,
      nextQuestion: nextQuestion
        ? {
            id: nextQuestion.id,
            life_stage_id: nextQuestion.life_stage_id,
            life_stage_ko: nextQuestion.life_stage_ko,
            life_stage_ja: nextQuestion.life_stage_ja,
            question_ko: nextQuestion.question_ko,
            question_ja: nextQuestion.question_ja,
          }
        : null,
      stagePosition: nextQuestion
        ? await getStagePosition(nextQuestion.life_stage_id, nextQuestion.id)
        : null,
      stageAdvanced:
        stageBefore !== null && stageAfter !== null && stageAfter !== stageBefore,
      done: stageAfter === null,
      progress: await getProgressSummary(userId),
    });
  } catch (err) {
    console.error("[generate]", err);
    return NextResponse.json(
      { error: "회고록 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
