import type { Lang } from "./auth";

export const STAGE_NAMES_SHORT: Record<Lang, Record<number, string>> = {
  ko: {
    1: "유년기",
    2: "학창시절",
    3: "사회초년",
    4: "커리어",
    5: "리더십",
    6: "위기극복",
    7: "인간관계",
    8: "가정",
    9: "가치관",
    10: "은퇴",
  },
  ja: {
    1: "幼少期",
    2: "学生時代",
    3: "社会人初期",
    4: "キャリア",
    5: "リーダーシップ",
    6: "危機克服",
    7: "人間関係",
    8: "家庭",
    9: "価値観",
    10: "引退後",
  },
};

export interface Dict {
  appName: string;
  appTagline: string;
  navInterview: string;
  navArchive: string;
  navSettings: string;
  myNumber: string;
  switchNumber: string;
  loginTitle: string;
  loginSubtitle: string;
  loginPlaceholder: string;
  loginButton: string;
  loginButtonLoading: string;
  loginLanguageLabel: string;
  loginHint1: string;
  loginHint2: string;
  loginErrorFormat: string;
  loginErrorGeneric: string;
  recordIdle: string;
  recordAction: string;
  redoAction: string;
  recordStop: string;
  recording: string;
  transcribing: string;
  generating: string;
  micDenied: string;
  micRetry: string;
  resend: string;
  rerecordInstead: string;
  silenceMessage: string;
  networkErrorMessage: string;
  recordingTimeWarning: string;
  recordingAutoStopped: string;
  previousQuestion: string;
  skipQuestion: string;
  backToCurrent: string;
  redoHeading: string;
  previousAnswerLabel: string;
  justAnsweredLabel: string;
  chapterLabelDefault: string;
  redoSavedNote: string;
  skippedNote: string;
  noPreviousNote: string;
  stageAdvancedNote: string;
  allDoneTitle: string;
  allDoneBody: string;
  allStagesDone: string;
  questionCountLabel: (position: number, total: number, stage: string) => string;
  archiveEmpty: string;
  archiveProgress: (answered: number, total: number, started: number, stages: number) => string;
  settingsTitle: string;
  settingsBody: string;
}

const dict: Record<Lang, Dict> = {
  ko: {
    appName: "가치",
    appTagline: "닛케이「私の履歴書」에서 영감을 받은 106개 질문으로, 목소리로 답하며 완성하는 나만의 회고록입니다.",
    navInterview: "인터뷰",
    navArchive: "내 회고록",
    navSettings: "설정",
    myNumber: "번호",
    switchNumber: "다른 번호로 입장",
    loginTitle: "가치",
    loginSubtitle: "나만의 번호를 입력하고 입장해주세요",
    loginPlaceholder: "예: 1234",
    loginButton: "입장하기",
    loginButtonLoading: "입장 중…",
    loginLanguageLabel: "언어를 선택해주세요",
    loginHint1: "처음 입력하는 번호면 자동으로 새 계정이 만들어져요.",
    loginHint2: "이 번호가 곧 비밀번호예요. 다른 사람에게 알려주지 마세요.",
    loginErrorFormat: "숫자 4자리로 입력해주세요.",
    loginErrorGeneric: "알 수 없는 오류가 발생했습니다.",
    recordIdle: "아래 버튼을 누르고\n편하게 말씀해주세요",
    recordAction: "답변 시작하기",
    redoAction: "다시 답변 시작하기",
    recordStop: "녹음 중지",
    recording: "녹음 중 — 편하게 이야기해보세요",
    transcribing: "음성을 텍스트로 변환하고 있어요…",
    generating: "회고록 챕터를 작성하고 있어요…",
    micDenied: "마이크 접근이 거부되었습니다. 브라우저 설정을 확인해주세요.",
    micRetry: "다시 시도",
    resend: "다시 보내기",
    rerecordInstead: "새로 녹음하기",
    silenceMessage: "아무 말도 들리지 않았어요. 다시 녹음해주세요.",
    networkErrorMessage: "네트워크 연결을 확인하고 다시 보내주세요.",
    recordingTimeWarning: "곧 녹음이 자동으로 종료돼요",
    recordingAutoStopped: "10분이 지나 자동으로 녹음을 종료했어요",
    previousQuestion: "이전 질문",
    skipQuestion: "건너뛰기",
    backToCurrent: "현재 질문으로 돌아가기",
    redoHeading: "이전 질문에 다시 답변하기",
    previousAnswerLabel: "이전 답변",
    justAnsweredLabel: "방금 남긴 이야기",
    chapterLabelDefault: "회고록 챕터",
    redoSavedNote: "이전 답변이 수정됐어요",
    skippedNote: "질문을 건너뛰었어요",
    noPreviousNote: "아직 답변한 질문이 없어요",
    stageAdvancedNote: "다음 생애주기로 넘어갑니다 →",
    allDoneTitle: "106개 질문을 모두 마쳤습니다",
    allDoneBody: "“내 회고록” 메뉴에서 지금까지 쌓인 이야기를 확인해보세요.",
    allStagesDone: "모든 생애주기를 완료했어요",
    questionCountLabel: (position: number, total: number, stage: string) =>
      `${total}개 질문 중 ${position}번째 · ${stage}`,
    archiveEmpty: "아직 남긴 이야기가 없어요. 인터뷰 페이지에서 첫 질문에 답해보세요.",
    archiveProgress: (answered: number, total: number, started: number, stages: number) =>
      `${answered}/${total} 질문 답변 완료 · ${started}/${stages} 생애주기 진행중`,
    settingsTitle: "설정",
    settingsBody: "준비 중이에요.",
  },
  ja: {
    appName: "가치",
    appTagline: "日経「私の履歴書」に着想を得た106の質問に、声で答えて完成させる自分だけの回顧録です。",
    navInterview: "インタビュー",
    navArchive: "マイ回顧録",
    navSettings: "設定",
    myNumber: "番号",
    switchNumber: "別の番号で入る",
    loginTitle: "가치",
    loginSubtitle: "ご自身の番号を入力して入室してください",
    loginPlaceholder: "例: 1234",
    loginButton: "入室する",
    loginButtonLoading: "入室中…",
    loginLanguageLabel: "言語を選択してください",
    loginHint1: "初めて入力する番号なら自動で新しいアカウントが作られます。",
    loginHint2: "この番号がそのままパスワードです。他の人に教えないでください。",
    loginErrorFormat: "数字4桁で入力してください。",
    loginErrorGeneric: "不明なエラーが発生しました。",
    recordIdle: "下のボタンを押して\n気軽にお話しください",
    recordAction: "回答を始める",
    redoAction: "もう一度回答する",
    recordStop: "録音を止める",
    recording: "録音中 — 気軽にお話しください",
    transcribing: "音声をテキストに変換しています…",
    generating: "回顧録の章を作成しています…",
    micDenied: "マイクへのアクセスが拒否されました。ブラウザの設定をご確認ください。",
    micRetry: "もう一度試す",
    resend: "送り直す",
    rerecordInstead: "録り直す",
    silenceMessage: "何も聞こえませんでした。もう一度録音してください。",
    networkErrorMessage: "ネットワーク接続を確認してもう一度送信してください。",
    recordingTimeWarning: "まもなく録音が自動的に終了します",
    recordingAutoStopped: "10分経過したため録音を自動的に終了しました",
    previousQuestion: "前の質問",
    skipQuestion: "スキップ",
    backToCurrent: "現在の質問に戻る",
    redoHeading: "前の質問にもう一度答える",
    previousAnswerLabel: "前回の回答",
    justAnsweredLabel: "たった今残した話",
    chapterLabelDefault: "回顧録の章",
    redoSavedNote: "前回の回答を修正しました",
    skippedNote: "質問をスキップしました",
    noPreviousNote: "まだ回答した質問がありません",
    stageAdvancedNote: "次のライフステージに進みます →",
    allDoneTitle: "106の質問すべてに回答しました",
    allDoneBody: "「マイ回顧録」メニューでこれまでの話を確認してみてください。",
    allStagesDone: "すべてのライフステージが完了しました",
    questionCountLabel: (position: number, total: number, stage: string) =>
      `${total}問中${position}問目・${stage}`,
    archiveEmpty: "まだ残した話がありません。インタビューページで最初の質問に答えてみましょう。",
    archiveProgress: (answered: number, total: number, started: number, stages: number) =>
      `${answered}/${total} 問回答済み · ${started}/${stages} ライフステージ進行中`,
    settingsTitle: "設定",
    settingsBody: "準備中です。",
  },
};

export type DictKey = keyof Dict;

export function getDict(lang: Lang): Dict {
  return dict[lang];
}
