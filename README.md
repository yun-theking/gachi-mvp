# 가치 (Gachi) — 시니어 AI 회고록 서비스

닛케이신문「私の履歴書」83인 회고록을 분석해 만든 **생애주기 10단계 × 106개 질문뱅크**를 기반으로,
음성 인터뷰 → 회고록 챕터 자동 생성 → 개인 아카이브에 누적 저장하는 웹 서비스.

## 지금 상태 (2026-08-15 기준)

기능 구현 + 로컬 동작 검증까지 완료. **배포는 아직 안 되어 있고, 디자인은 기능 검증용 최소 버전**입니다.
다음 단계는 **웹 디자인 다듬기 + 테스트**입니다 (아래 "다음 담당자가 할 일" 참고).

## 빠른 시작

```bash
npm install
cp .env.local.example .env.local   # OPENAI_API_KEY 채워넣기
npm run dev
```

`http://localhost:3000` 접속. 첫 실행 시 `data/gachi.db`가 자동 생성되고 106개 질문이 시드됩니다.

⚠️ **Node 버전 주의**: Node 22+ 필요 (`node:sqlite` 내장 모듈 사용). Node 25.x에서는 Web Storage API 기본 활성화 버그로 페이지 렌더링이 깨지는데, `package.json`의 `dev`/`build`/`start` 스크립트에 이미 `NODE_OPTIONS=--no-experimental-webstorage`를 넣어서 우회 처리해뒀습니다. 직접 안 건드려도 됨.

## 어떻게 동작하나

1. 사용자가 화면에 뜬 질문(106개 중 1개, 생애주기 순서대로 진행)에 음성으로 답변
2. `/api/transcribe` — Whisper로 STT
3. `/api/generate` — GPT-4o가 (a) 답변을 1인칭 회고록 챕터로 재구성하고, (b) 현재 생애주기의 남은 질문 후보 중 대화 맥락에 가장 잘 맞는 다음 질문 1개를 **id로 선택** (질문 문구 자체는 GPT가 새로 짓지 않고 항상 DB의 큐레이션된 원문 그대로 사용)
4. 결과를 SQLite(`entries` 테이블)에 저장 → `/archive` 페이지에서 생애주기별로 모아볼 수 있음

## 프로젝트 구조

```
app/page.tsx              메인 인터뷰 화면 (질문 카드 → 녹음 → 챕터 생성 → 다음 질문)
app/archive/page.tsx      개인 회고록 아카이브 (생애주기별 챕터 모음)
app/api/transcribe/       Whisper STT
app/api/generate/         챕터 생성 + 다음 질문 선택 + DB 저장 (핵심 로직)
app/api/next-question/    앱 최초 로드 시 "지금 물어볼 질문" 조회
app/api/entries/          아카이브용 전체 기록 + 진행률 조회
components/               QuestionCard, RecordButton, ChapterPanel, StageProgress
lib/db.ts                 SQLite 연결 + 자동 시드
lib/questions.ts          생애주기/질문 선택 헬퍼
data/question_bank.json   질문뱅크 원본 (106개, 한/일 병기) — 여기가 source of truth
```

레거시/실험 파일(건드릴 필요 없음): `index.html`, `server.py`, `share.html` — 초기 vanilla JS 프로토타입. `gap_question_demo.py`, `s2s_latency_test.py` — 리서치용 스크립트.

## 디자인 시스템

`tailwind.config.ts`에 다크 골드 팔레트 정의됨 (`bg`, `surface`, `gold`, `gold-light`, `text`, `text-dim` 등). 세리프 폰트(Noto Serif KR)는 챕터 본문에, 산세리프(Noto Sans KR)는 UI 텍스트에 사용. 시니어 사용자 대상이므로 **폰트 크기·터치 타겟·명암비**를 넉넉하게 유지할 것.

## 다음 담당자가 할 일 (웹 디자인 + 테스트)

- [ ] 시니어 사용자 기준 UI 재점검 (글자 크기, 버튼 크기, 색 대비, 음성 안내 필요 여부)
- [ ] 모바일 반응형 점검 (지금은 데스크톱 위주로만 확인됨)
- [ ] 녹음 흐름 실사용 테스트 (마이크 권한 거부, 긴 침묵, 네트워크 끊김 등 예외 상황)
- [ ] `/archive` 페이지 UX 개선 (질문별 재답변, 챕터 수정 기능 등 필요하면 논의)
- [ ] 실제 배포처 결정 시 주의: 현재 SQLite는 **로컬 파일 기반**이라 Vercel 같은 서버리스에는 그대로 못 올라감 (아래 "배포/공유 방법" 참고)

## 배포/공유 방법

### 지금 당장 팀원에게 보여주고 싶을 때 (임시 링크)
```bash
npm run dev              # 터미널 1
ngrok http 3000          # 터미널 2 — 이미 설치되어 있음
```
ngrok이 주는 `https://xxxx.ngrok-free.dev` 링크를 공유. 내 컴퓨터가 켜져 있어야만 접속 가능한 임시 링크.

### 진짜 배포 (다음 단계)
Next.js라 Vercel이 제일 자연스러운데, **Vercel 서버리스 환경은 로컬 파일(SQLite)을 유지 못 함** — 배포 전에 `lib/db.ts`를 Postgres 계열(Vercel Postgres, Supabase, Turso 등)로 바꿔야 함. 아니면 Railway/Render/Fly.io처럼 영구 디스크를 주는 곳에 올리면 지금 SQLite 코드 그대로 써도 됨. 이 부분은 다음 작업 들어가기 전에 팀 안에서 먼저 정하는 게 좋음.

## 참고
- 질문뱅크 원본 분석 과정 및 방법론: `/Users/kwpark/gachiqlist` (닛케이「私の履歴書」83인 회고록 분석)
- 이번 리뉴얼 작업 계획서: `/Users/kwpark/.claude/plans/partitioned-gliding-quilt.md`
