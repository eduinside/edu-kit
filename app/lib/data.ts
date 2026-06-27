// 꾸러미 메타(kits.json) — 홈·뷰어 공통, 가벼움. 무거운 items/stage_meta는 kit-content.ts로 분리.
import kits from "../../data/kits.json";
import type { Kit, Item, StageMeta, Stage, Grade, Semester, Subject } from "../../scripts/types.ts";

export type { Kit, Item, StageMeta, Stage, Grade, Semester, Subject };

export const KITS = kits as Kit[];

export function getKit(id: string): Kit | undefined {
  return KITS.find((k) => k.id === id);
}
