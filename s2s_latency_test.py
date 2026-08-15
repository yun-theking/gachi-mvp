"""
S2S Latency Test — Gachi 자서전 앱
======================================
GPT-4o 기반 파이프라인의 음성 응답 속도를 측정합니다.

[참고] GPT-4o Realtime API는 별도 beta 접근이 필요합니다.
       이 스크립트는 현실적인 대안으로 두 가지를 측정합니다:

  [A] Chat API TTFT  : 텍스트 → 첫 번째 텍스트 토큰 (현재 gachi 방식)
  [B] TTS 파이프라인 : 텍스트 → 음성 파일 완성 (Chat API 응답 → TTS 변환)

실행:
  python s2s_latency_test.py
"""

import os
import time
import statistics
import tempfile

from openai import OpenAI

# ── 설정 ──────────────────────────────────────────────────────────────────────
API_KEY = os.environ.get("OPENAI_API_KEY") or open(".env.local").read().split("OPENAI_API_KEY=")[1].split("\n")[0].strip()
client = OpenAI(api_key=API_KEY)
TRIALS = 5
TEST_PROMPT = "제 삶에서 가장 기억에 남는 순간을 한 문장으로 말해주세요."
SHORT_TEXT = "삶의 소중한 순간들은 작은 일상 속에 숨어 있습니다."  # TTS 단독 테스트용


# ── A. Chat API 스트리밍 TTFT ─────────────────────────────────────────────────
def measure_chat_ttft() -> float:
    """텍스트 → 첫 번째 스트리밍 토큰까지 ms"""
    t_start = time.perf_counter()
    stream = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": TEST_PROMPT}],
        stream=True,
        max_tokens=40,
    )
    for chunk in stream:
        if chunk.choices and chunk.choices[0].delta.content:
            elapsed = (time.perf_counter() - t_start) * 1000
            stream.close()
            return elapsed
    return -1


# ── B. TTS 파이프라인 총 지연 ─────────────────────────────────────────────────
def measure_tts_pipeline() -> dict:
    """
    Chat API 전체 응답 → TTS 변환까지 총 지연.
    반환: {chat_ms, tts_ms, total_ms, char_count}
    """
    # 1) Chat API — 전체 응답 생성
    t0 = time.perf_counter()
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": TEST_PROMPT}],
        max_tokens=40,
    )
    answer = response.choices[0].message.content
    chat_ms = (time.perf_counter() - t0) * 1000

    # 2) TTS — 텍스트를 음성으로 변환
    t1 = time.perf_counter()
    with client.audio.speech.with_streaming_response.create(
        model="tts-1",
        voice="alloy",
        input=answer,
        response_format="mp3",
    ) as audio_resp:
        first_chunk = True
        tts_ttfc = 0.0  # time to first audio chunk
        for _ in audio_resp.iter_bytes(chunk_size=4096):
            if first_chunk:
                tts_ttfc = (time.perf_counter() - t1) * 1000
                first_chunk = False
            break  # 첫 청크만 확인
    tts_ms = tts_ttfc

    return {
        "chat_ms": chat_ms,
        "tts_ms": tts_ms,
        "total_ms": chat_ms + tts_ms,
        "char_count": len(answer),
        "answer": answer,
    }


# ── 통계 출력 ─────────────────────────────────────────────────────────────────
def print_stats(label: str, results: list[float]):
    avg = statistics.mean(results)
    mn  = min(results)
    mx  = max(results)
    sd  = statistics.stdev(results) if len(results) > 1 else 0
    print(f"\n{'─'*55}")
    print(f"  {label}")
    print(f"{'─'*55}")
    for i, r in enumerate(results, 1):
        print(f"  Trial {i}: {r:7.0f} ms")
    print(f"{'─'*55}")
    print(f"  평균(avg)  : {avg:7.0f} ms")
    print(f"  최소(min)  : {mn:7.0f} ms")
    print(f"  최대(max)  : {mx:7.0f} ms")
    print(f"  표준편차   : {sd:7.0f} ms")
    print(f"{'─'*55}")
    return avg


def main():
    print("=" * 60)
    print("  Gachi S2S Latency Report")
    print(f"  테스트 횟수: {TRIALS}회 | 모델: gpt-4o + tts-1")
    print("=" * 60)
    print(f"\n  프롬프트: \"{TEST_PROMPT}\"")

    # ─ A: Chat API TTFT ─
    print(f"\n[A] Chat API TTFT 측정 중... (첫 토큰까지)")
    chat_ttft_list = []
    for i in range(TRIALS):
        ms = measure_chat_ttft()
        chat_ttft_list.append(ms)
        print(f"    Trial {i+1}: {ms:.0f} ms", flush=True)
        time.sleep(0.3)

    # ─ B: TTS 파이프라인 ─
    print(f"\n[B] TTS 파이프라인 측정 중... (Chat응답 → 첫 음성 청크)")
    chat_full_list = []
    tts_list = []
    total_list = []
    for i in range(TRIALS):
        result = measure_tts_pipeline()
        chat_full_list.append(result["chat_ms"])
        tts_list.append(result["tts_ms"])
        total_list.append(result["total_ms"])
        print(f"    Trial {i+1}: chat={result['chat_ms']:.0f}ms + tts={result['tts_ms']:.0f}ms = {result['total_ms']:.0f}ms  ({result['char_count']}자)", flush=True)
        time.sleep(0.3)

    # ─ 결과 출력 ─
    avg_a = print_stats("A  Chat API TTFT (현재 gachi 텍스트 응답)", chat_ttft_list)
    avg_b = print_stats("B  Chat API 전체 응답 소요 시간", chat_full_list)
    avg_tts = print_stats("B  TTS 변환 (첫 오디오 청크)", tts_list)
    avg_total = print_stats("B  총 S2S 파이프라인 (Chat + TTS)", total_list)

    print(f"\n{'='*60}")
    print(f"  최종 요약")
    print(f"{'='*60}")
    print(f"  현재 gachi 텍스트 TTFT   :  {avg_a:6.0f} ms")
    print(f"  S2S 파이프라인 (Chat+TTS) :  {avg_total:6.0f} ms")
    print(f"  ─ 그 중 TTS 변환만        :  {avg_tts:6.0f} ms")
    print(f"{'='*60}")
    print(f"\n  [참고] GPT-4o Realtime API는 약 200-500ms로 알려짐")
    print(f"         (위 파이프라인 대비 약 {avg_total-350:.0f}ms 빠름 예상)")
    print(f"         — 단, Realtime API는 별도 beta 접근 권한 필요")
    print()


if __name__ == "__main__":
    main()
