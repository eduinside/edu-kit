// 수업꾸러미 콘텐츠 논리 모델 (정적 JSON 형상 = 향후 D1 edukit_* 스키마)
// 정본: _prototype/design_handoff_수업꾸러미/DATA_MODEL.md

export type Grade = 3 | 4 | 5 | 6;
export type Semester = "1학기" | "2학기";
export type Subject = "사회" | "과학";
export type Flow = "activity" | "flow";
export type ItemType = "intro" | "video" | "image" | "text";

// 활동형: 단원안내·생각열기·탐구하기·확장하기 / 흐름형: 도입·전개·정리
export type Stage =
  | "단원안내"
  | "생각열기"
  | "탐구하기"
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
  standard_code?: string;
  standard_text?: string;

  // video 전용
  video_url?: string;
  video_id?: string;
  video_title?: string;
  video_desc?: string;
  start_sec?: number;
  end_sec?: number;
  video_license?: string;

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

export interface ContentBundle {
  kits: Kit[];
  items: Item[];
  stage_meta: StageMeta[];
}
