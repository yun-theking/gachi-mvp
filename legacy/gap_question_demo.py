"""
Gap Question Demo — Gachi 자서전 앱
======================================
사용자가 말한 자서전 내용을 분석해서, 빠진 부분(gap)을 채울
날카롭고 의미 있는 후속 질문을 GPT-4o가 생성합니다.

실행:
  python gap_question_demo.py
"""

import os
import time
from openai import OpenAI

# ── 설정 ──────────────────────────────────────────────────────────────────────
API_KEY = os.environ.get("OPENAI_API_KEY") or open(".env.local").read().split("OPENAI_API_KEY=")[1].split("\n")[0].strip()
client = OpenAI(api_key=API_KEY)

# ── 샘플 자서전 컨텍스트 (사용자가 말한 내용 시뮬레이션) ──────────────────────
SAMPLE_CONTEXTS = [
    {
        "label": "Case 1 — 어린 시절 이민",
        "text": """
저는 열두 살 때 부모님과 함께 한국에서 미국으로 이민을 왔어요.
영어를 전혀 못했고 처음에는 학교에서 많이 힘들었어요.
그래도 어떻게든 적응했고, 결국 대학도 가고 지금은 잘 살고 있어요.
        """.strip()
    },
    {
        "label": "Case 2 — 창업 경험",
        "text": """
30대 초반에 회사를 그만두고 스타트업을 창업했습니다.
처음엔 아이디어가 좋다고 생각했는데 생각보다 많이 힘들었고
결국 2년 만에 접었어요. 지금은 다시 취업해서 일하고 있습니다.
        """.strip()
    },
    {
        "label": "Case 3 — 부모님과의 관계",
        "text": """
아버지는 굉장히 엄하셨어요. 대화가 별로 없었고
항상 공부, 성적 이야기만 했던 것 같아요.
나중에 제가 어른이 되고 나서야 조금씩 가까워진 것 같습니다.
        """.strip()
    },
]

SYSTEM_PROMPT = """당신은 자서전 인터뷰 전문가입니다.
사용자가 자신의 삶에 대해 말한 내용을 들으면,
그 이야기에서 빠진 중요한 부분(gap)을 파악하고
더 깊은 이야기를 끌어낼 수 있는 날카롭고 따뜻한 후속 질문 5개를 생성하세요.

질문 원칙:
- 구체적인 사실보다 감정, 동기, 의미를 묻는 질문 우선
- "예/아니오"로 답할 수 없는 열린 질문
- 빠진 타임라인·관계·감정을 메우는 질문
- 한국어로 작성, 번호 매기기 (1. 2. 3. 4. 5.)
- 각 질문 뒤에 괄호로 [왜 이 질문인지 한 줄 이유] 추가"""


def generate_gap_questions(context: str) -> tuple[str, float]:
    """자서전 컨텍스트를 받아 gap 질문을 생성하고 (응답, 소요ms)를 반환"""
    t_start = time.perf_counter()
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"다음은 사용자가 말한 자서전 내용입니다:\n\n{context}\n\n이 이야기의 빈 부분을 채울 후속 질문 5개를 생성해주세요."}
        ],
        temperature=0.8,
        max_tokens=600,
    )
    elapsed_ms = (time.perf_counter() - t_start) * 1000
    return response.choices[0].message.content, elapsed_ms


def run_demo():
    print("=" * 65)
    print("  Gachi Gap Question Demo")
    print("  자서전 내용 → GPT-4o → 날카로운 후속 질문 생성")
    print("=" * 65)

    latencies = []

    for case in SAMPLE_CONTEXTS:
        print(f"\n{'━'*65}")
        print(f"  {case['label']}")
        print(f"{'━'*65}")
        print(f"\n[사용자 입력]\n{case['text']}\n")
        print("[GPT-4o 생성 중...]")

        questions, ms = generate_gap_questions(case["text"])
        latencies.append(ms)

        print(f"\n[후속 질문] (응답시간: {ms:.0f} ms)\n")
        print(questions)

    print(f"\n{'='*65}")
    print(f"  전체 {len(latencies)}건 평균 응답시간: {sum(latencies)/len(latencies):.0f} ms")
    print(f"{'='*65}\n")


if __name__ == "__main__":
    run_demo()
