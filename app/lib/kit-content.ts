// 꾸러미 콘텐츠(항목·단계·퀴즈) — 연 꾸러미 몫만 받는다(public/k/<id>.<hash>.json, scripts/site-content.ts가 만든다).
// 전에는 items.json 전체(모든 꾸러미)를 뷰어 번들에 묶었다. 해시 목록(content-index.json)만 번들에 들어간다.
import { useEffect, useState } from "react";
import index from "../../data/content-index.json";
import type { Item, Stage } from "../../scripts/types.ts";
import type { ContentIndex, KitContent, SearchIndex } from "../../scripts/site-content.ts";

export type { KitContent, SearchIndex };
const INDEX = index as ContentIndex;

/** 한 꾸러미의 stage 그룹(메타 + 항목) — 뷰어 목차/본문용 */
export interface ViewerGroup {
  stage: Stage;
  question: string | null;
  sort_order: number;
  items: Item[];
}

class StaleContentError extends Error {}

// 같은 파일을 여러 곳(미리 받기·뷰어·모음)에서 불러도 한 번만 받는다. 실패하면 지워서 다시 시도할 수 있게.
const cache = new Map<string, Promise<unknown>>();
function getJson<T>(url: string): Promise<T> {
  let p = cache.get(url) as Promise<T> | undefined;
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      // 새로 배포되면 옛 해시 파일은 없어지고 SPA 폴백(index.html)이 200으로 온다 → 페이지를 새로 받아야 한다
      if (!(r.headers.get("content-type") ?? "").includes("json")) throw new StaleContentError(url);
      return r.json() as Promise<T>;
    });
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return p;
}

export function hasKitContent(kitId: string): boolean {
  return Boolean(INDEX.kits[kitId]);
}

export function loadKit(kitId: string): Promise<KitContent> {
  const h = INDEX.kits[kitId];
  if (!h) return Promise.reject(new Error(`no content: ${kitId}`));
  return getJson<KitContent>(`/k/${kitId}.${h}.json`);
}

/** 홈 카드에 마우스를 올리거나 초점이 가면 미리 받아 둔다(실패는 무시 - 열 때 다시 받는다). */
export function prefetchKit(kitId: string): void {
  if (INDEX.kits[kitId]) loadKit(kitId).catch(() => {});
}

export function loadSearchIndex(): Promise<SearchIndex> {
  return getJson<SearchIndex>(`/k/search.${INDEX.search}.json`);
}

/** 모음 항목 참조("<kit>/<key>")에 해당하는 영상들 — 든 꾸러미 파일만 동시에 받는다. */
export async function loadVideos(refs: string[]): Promise<Map<string, Item>> {
  const kitIds = [...new Set(refs.map((r) => r.split("/")[0] ?? ""))].filter((id) => INDEX.kits[id]);
  const contents = await Promise.all(kitIds.map(loadKit));
  const byRef = new Map<string, Item>();
  for (const c of contents) for (const i of c.items) if (i.type === "video") byRef.set(`${i.kit_id}/${i.item_key}`, i);
  return byRef;
}

export type Loaded<T> = { status: "loading" } | { status: "error"; retry: () => void } | { status: "ready"; data: T };

/** 약속(Promise)을 화면 상태로 — key가 바뀌면 다시 받고, 실패하면 retry로 다시 시도한다. */
export function useLoaded<T>(key: string | null, load: () => Promise<T>): Loaded<T> {
  // 상태에 key를 같이 적어 두고, 다른 꾸러미로 넘어간 첫 화면에서 앞 꾸러미 내용이 잠깐 보이지 않게 한다.
  const [state, setState] = useState<{ key: string | null; value: Loaded<T> }>({ key, value: { status: "loading" } });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (key === null) return;
    let cancelled = false;
    setState({ key, value: { status: "loading" } });
    load().then(
      (data) => { if (!cancelled) setState({ key, value: { status: "ready", data } }); },
      (e) => {
        if (cancelled) return;
        // 옛 배포의 파일을 찾은 경우: 다시 받아도 같으니 페이지를 새로 불러온다
        const retry = e instanceof StaleContentError ? () => window.location.reload() : () => setAttempt((a) => a + 1);
        setState({ key, value: { status: "error", retry } });
      },
    );
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);
  return state.key === key ? state.value : { status: "loading" };
}

// 단계 표준 순서 — 활동형(단원안내·생각열기·탐구하기(1/2)·확장하기) + 흐름형(도입·전개·정리)
const STAGE_ORDER: Stage[] = ["단원안내", "생각열기", "탐구하기", "탐구하기1", "탐구하기2", "확장하기", "도입", "전개", "정리"];

export function groupsOf(content: KitContent): ViewerGroup[] {
  const its = content.items;
  const metaByStage = new Map(content.stage_meta.map((m) => [m.stage, m]));
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
