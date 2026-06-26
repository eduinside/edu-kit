// 빌드 산출(data/*.json, prebuild=sync 생성)을 타입과 함께 로드.
import kits from "../../data/kits.json";
import items from "../../data/items.json";
import stageMeta from "../../data/stage_meta.json";
import type { Kit, Item, StageMeta, Stage, Grade, Semester, Subject } from "../../scripts/types.ts";

export type { Kit, Item, StageMeta, Stage, Grade, Semester, Subject };

export const KITS = kits as Kit[];
export const ITEMS = items as Item[];
export const STAGE_META = stageMeta as StageMeta[];

export function getKit(id: string): Kit | undefined {
  return KITS.find((k) => k.id === id);
}

/** 한 꾸러미의 stage 그룹(메타 + 항목) — 뷰어 목차/본문용 */
export interface ViewerGroup {
  stage: Stage;
  question: string | null;
  sort_order: number;
  items: Item[];
}

export function getGroups(kitId: string): ViewerGroup[] {
  const metas = STAGE_META.filter((m) => m.kit_id === kitId).sort(
    (a, b) => a.sort_order - b.sort_order
  );
  const its = ITEMS.filter((i) => i.kit_id === kitId);
  return metas
    .map((m) => ({
      stage: m.stage,
      question: m.question,
      sort_order: m.sort_order,
      items: its
        .filter((i) => i.stage === m.stage)
        .sort((a, b) => a.sort_order - b.sort_order),
    }))
    .filter((g) => g.items.length > 0);
}

export function flatItems(groups: ViewerGroup[]): Item[] {
  return groups.flatMap((g) => g.items);
}
