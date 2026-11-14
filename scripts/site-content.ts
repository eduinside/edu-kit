// 사이트용 콘텐츠 파일(build-data가 부른다) — 꾸러미 하나를 열 때 그 꾸러미 몫만 받게 나눈다.
// 전에는 뷰어가 items.json(전체 꾸러미, 약 1.6MB)·quiz.json을 통째로 번들에 묶어 받았다.
//   public/k/<id>.<hash>.json   꾸러미 1개: items + stage_meta + quiz
//   public/k/search.<hash>.json 검색 색인: 공개 꾸러미 소개(핵심 용어·성취기준) + 영상 제목·설명
//   data/content-index.json     위 파일들의 해시 목록(앱이 import — 작다)
// 파일 이름에 내용 해시가 들어가므로 1년 캐시(public/_headers /k/*)해도 내용이 바뀌면 주소가 바뀐다.
// 계획: edu-link docs/design-unify-plan.md §3-4

import { createHash } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Item, Kit, QuizItem, StageMeta } from "./types.ts";

export interface KitContent {
  items: Item[];
  stage_meta: StageMeta[];
  quiz: QuizItem[];
}

export interface SearchIndex {
  intros: Pick<Item, "kit_id" | "concepts" | "standards" | "standard_code" | "standard_text">[];
  videos: Pick<Item, "kit_id" | "item_key" | "title" | "video_title" | "video_desc">[];
}

export interface ContentIndex {
  search: string;
  kits: Record<string, string>;
}

const hashOf = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 10);

export function writeSiteContent(
  root: string,
  data: { kits: Kit[]; items: Item[]; stageMeta: StageMeta[]; quiz: QuizItem[] },
): ContentIndex {
  const dir = resolve(root, "public/k");
  rmSync(dir, { recursive: true, force: true }); // 지난 빌드의 옛 해시 파일 정리
  mkdirSync(dir, { recursive: true });

  const group = <T extends { kit_id: string }>(rows: T[]) => {
    const m = new Map<string, T[]>();
    for (const r of rows) (m.get(r.kit_id) ?? m.set(r.kit_id, []).get(r.kit_id)!).push(r);
    return m;
  };
  const items = group(data.items), meta = group(data.stageMeta), quiz = group(data.quiz);

  const index: ContentIndex = { search: "", kits: {} };
  for (const k of data.kits) {
    const body: KitContent = { items: items.get(k.id) ?? [], stage_meta: meta.get(k.id) ?? [], quiz: quiz.get(k.id) ?? [] };
    const json = JSON.stringify(body);
    const h = hashOf(json);
    writeFileSync(resolve(dir, `${k.id}.${h}.json`), json);
    index.kits[k.id] = h;
  }

  const pub = new Set(data.kits.filter((k) => k.published).map((k) => k.id));
  const search: SearchIndex = {
    intros: data.items
      .filter((i) => i.type === "intro" && pub.has(i.kit_id))
      .map(({ kit_id, concepts, standards, standard_code, standard_text }) => ({ kit_id, concepts, standards, standard_code, standard_text })),
    videos: data.items
      .filter((i) => i.type === "video" && pub.has(i.kit_id))
      .map(({ kit_id, item_key, title, video_title, video_desc }) => ({ kit_id, item_key, title, video_title, video_desc })),
  };
  const sjson = JSON.stringify(search);
  index.search = hashOf(sjson);
  writeFileSync(resolve(dir, `search.${index.search}.json`), sjson);

  writeFileSync(resolve(root, "data/content-index.json"), JSON.stringify(index, null, 2) + "\n");
  return index;
}
