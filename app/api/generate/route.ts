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
import { USER_COOKIE } from "@/lib/auth";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const userId = req.cookies.get(USER_COOKIE)?.value;
    if (!userId) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

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
    const askedKo = askedQuestion?.question_ko ?? "(자유 답변)";

    const stageBefore = await getCurrentStageId(userId);

    // Candidates for the *next* question: remaining questions in the same stage,
    // excluding the one the user just answered. The model may only pick from this list —
    // it never invents question text itself.
    const stageCandidates = (await getRemainingQuestions(userId, lifeStageId)).filter(
      (q) => q.id !== questionId
    );
    const candidateList = stageCandidates
      .map((q) => `- id:${q.id} "${q.question_ko}"`)
      .join("\n");

    const systemPrompt = `당신은 시니어의 삶의 이야기를 아름다운 회고록으로 엮어주는 인터뷰 작가입니다.
사용자가 방금 아래 질문에 음성으로 답변했습니다.

[방금 받은 질문]
${askedKo}

이 답변을 바탕으로 두 가지를 JSON으로 반환하세요.

1. chapter: 사용자의 답변을 1인칭 회고록 챕터 초안으로 작성. 문학적이고 따뜻한 문체로 200~400자.
2. next_question_id: 아래 후보 질문 목록 중, 지금까지의 대화 흐름상 다음으로 묻기에 가장 자연스러운 질문의 id 하나.
   반드시 후보 목록에 있는 id 중 하나만 그대로 선택하세요. 질문 문구를 새로 짓거나 바꾸지 마세요.

[다음 질문 후보]
${candidateList || "(이 생애주기의 후보가 모두 소진되었습니다. next_question_id는 null로 응답하세요.)"}

반드시 아래 JSON 형식만 출력하세요. 다른 텍스트는 절대 포함하지 마세요.
{"chapter": "...", "next_question_id": <숫자 또는 null>}`;

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

    // Persist this turn now that we have the generated chapter.
    await saveEntry({
      userId,
      questionId: askedQuestion?.id ?? null,
      lifeStageId,
      questionKo: askedKo,
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
