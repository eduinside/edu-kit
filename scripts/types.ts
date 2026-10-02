// 수업꾸러미 콘텐츠 논리 모델 (정적 JSON 형상 = 향후 D1 edukit_* 스키마)
// 사이트 데이터(data/*.json) 형식 — 빌드(scripts/transform.ts) 산출. 정본 입력 형식은 docs/OPERATIONS.md §2(content/kits/*.yaml)

export type Grade = 3 | 4 | 5 | 6;
export type Semester = "1학기" | "2학기";
export type Subject = "사회" | "과학";
export type Flow = "activity" | "flow";
export type ItemType = "intro" | "video" | "image" | "text";

// 활동형: 단원안내·생각열기·탐구하기(1/2)·확장하기 / 흐름형: 도입·전개·정리
// 탐구하기1/탐구하기2: 탐구하기가 두 개의 탐구질문으로 나뉘는 단원에서 사용(선택적 세분화).
export type Stage =
  | "단원안내"
  | "생각열기"
  | "탐구하기"
  | "탐구하기1"
  | "탐구하기2"
  | "확장하기"
  | "도입"
  | "전개"
  | "정리";

export interface Kit {
  id: string; // shortId, 4자 base31 — 라우트 :kitId와 동일 값
  title: string;
  grade: Grade;
  sem: Semester;
  subject: Subject;
  unit: string; // 대단원명
  unit_no: number;
  flow: Flow;
  sort_order: number;
  published: boolean;
  content_count?: number; // 빌드 시 산출(intro 제외 항목 수). 홈 카드 표시용 — 시트 입력값 아님.
}

export interface Item {
  id: string; // 전역 유니크 (예: ab12_v1)
  kit_id: string;
  item_key: string; // URL /k/:kitId/:itemId 의 itemId
  stage: Stage;
  type: ItemType;
  title: string; // 흐름형은 핵심용어가 title
  description?: string; // 흐름형은 영상제목을 desc로
  sort_order: number;

  // intro 전용
  core_idea?: string;
  core_question?: string;
  concepts?: string[];
  concept_desc?: string; // 시트 원본(';' 구분, concepts와 순서로 짝). 화면은 아래 concept_defs 사용.
  concept_defs?: { term: string; def: string }[]; // 빌드 산출: concepts[i]와 concept_desc[i]를 짝지은 용어 설명
  standard_code?: string; // 시트 원본(복수면 ' ; ' 구분). 화면은 아래 standards 사용.
  standard_text?: string; // 시트 원본(복수면 ' ; ' 구분, code와 순서로 짝)
  standards?: { code: string; text: string }[]; // 빌드 산출: code/text를 ;로 분리·짝지은 성취기준 목록

  // video 전용
  video_url?: string;
  video_id?: string;
  video_title?: string;
  video_desc?: string;
  start_sec?: number;
  end_sec?: number;
  video_license?: string;
  /** 시트 video_embed=FALSE 일 때만 false로 실림(기본은 키 없음=임베드 가능).
   *  업로더가 외부 삽입을 막은 영상 → 뷰어가 재생 대신 '유튜브에서 열기' 카드를 보여준다. */
  video_embed?: false;

  // video/image 공용
  caption?: string;

  // image 전용
  image_url?: string;
  image_label?: string;
  image_sub?: string;
  image_source?: string;
  image_license?: string;

  // text 전용 — 빌드 산출(마크다운→.sk-rich HTML, 새니타이즈 완료)
  body?: string;
}

export interface StageMeta {
  kit_id: string;
  stage: Stage;
  question: string | null; // 없으면 null
  sort_order: number;
}

// 개념 확인 OX 퀴즈(단원 마지막 화면). items와 별도 탭/파일 — 뷰어 "항목"이 아니라 형상이 다름.
export interface QuizItem {
  kit_id: string;
  statement: string; // O/X 판단 문장(쉬운 난이도)
  answer: "O" | "X"; // 정답
  explain?: string; // 한 줄 해설
  sort_order: number;
}

export interface ContentBundle {
  kits: Kit[];
  items: Item[];
  stage_meta: StageMeta[];
  quiz: QuizItem[];
}
