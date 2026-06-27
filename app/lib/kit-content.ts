// 뷰어 전용 콘텐츠 데이터(items·stage_meta). 홈 번들에서 분리하기 위해 data.ts와 별도 모듈.
// ViewerPage(React.lazy)만 import → 무거운 items.json(~600KB)이 뷰어 청크로 코드 분할됨.
import items from "../../data/items.json";
import stageMeta from "../../data/stage_meta.json";
import type { Item, StageMeta, Stage } from "../../scripts/types.ts";

export const ITEMS = items as Item[];
export const STAGE_META = stageMeta as StageMeta[];

/** 한 꾸러미의 stage 그룹(메타 + 항목) — 뷰어 목차/본문용 */
export interface ViewerGroup {
  stage: Stage;
  question: string | null;
  sort_order: number;
  items: Item[];
}

// 단계 표준 순서 — 활동형(단원안내·생각열기·탐구하기·확장하기) + 흐름형(도입·전개·정리)
const STAGE_ORDER: Stage[] = ["단원안내", "생각열기", "탐구하기", "확장하기", "도입", "전개", "정리"];

export function getGroups(kitId: string): ViewerGroup[] {
  const its = ITEMS.filter((i) => i.kit_id === kitId);
  const metaByStage = new Map(
    STAGE_META.filter((m) => m.kit_id === kitId).map((m) => [m.stage, m])
  );
  // 그룹은 "실제 항목이 있는 stage"를 기준으로 구성한다.
  // (stage_meta에 단원안내 행이 없어도 intro가 누락되지 않도록 — 메타는 질문/순서 보강용으로만 사용)
  const rank = (s: Stage) => { const i = STAGE_ORDER.indexOf(s); return i < 0 ? 99 : i; };
  return [...new Set(its.map((i) => i.stage))]
    .sort((a, b) => rank(a) - rank(b) || (metaByStage.get(a)?.sort_order ?? 0) - (metaByStage.get(b)?.sort_order ?? 0))
    .map((stage) => ({
      stage,
      question: metaByStage.get(stage)?.question ?? null,
      sort_order: metaByStage.get(stage)?.sort_order ?? rank(stage),
      items: its.filter((i) => i.stage === stage).sort((a, b) => a.sort_order - b.sort_order),
    }));
}

export function flatItems(groups: ViewerGroup[]): Item[] {
  return groups.flatMap((g) => g.items);
}
