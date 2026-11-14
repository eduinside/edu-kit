// 통합 검색(스코프별 그룹): 단원(제목·핵심용어) / 영상(제목·설명) / 성취기준(단원 성취기준).
// 검색 색인(public/k/search.<hash>.json, kit-content.ts loadSearchIndex)은 검색 창을 열 때 받는다.
import { KITS } from "./data.ts";
import type { Kit } from "./data.ts";
import type { SearchIndex } from "./kit-content.ts";

export interface SearchResult {
  href: string; // /:kitId 또는 /:kitId/:itemKey
  title: string;
  snippet: string;
  crumb: string;
}
export interface SearchResults {
  단원: SearchResult[];
  영상: SearchResult[];
  성취기준: SearchResult[];
  total: number;
}

const norm = (s: unknown) => String(s ?? "").toLowerCase();
const crumbOf = (k: Kit) => `초등 ${k.grade}학년 · ${k.sem} · ${k.subject}`;
const cut = (s: string, n = 90) => (s.length > n ? s.slice(0, n) + "…" : s);

export function search(query: string, index: SearchIndex): SearchResults {
  const q = query.trim().toLowerCase();
  if (!q) return { 단원: [], 영상: [], 성취기준: [], total: 0 };

  const pub = KITS.filter((k) => k.published);
  const pubById = new Map<string, Kit>(pub.map((k) => [k.id, k]));
  const introByKit = new Map<string, SearchIndex["intros"][number]>();
  for (const it of index.intros) if (pubById.has(it.kit_id)) introByKit.set(it.kit_id, it);

  const 단원: SearchResult[] = [];
  const 성취기준: SearchResult[] = [];
  for (const k of pub) {
    const crumb = crumbOf(k);
    const intro = introByKit.get(k.id);
    // 단원: 제목 또는 핵심용어
    const titleHit = norm(k.title).includes(q);
    const conceptHit = intro?.concepts?.find((c) => norm(c).includes(q));
    if (titleHit || conceptHit) {
      단원.push({ href: `/${k.id}`, title: k.title, snippet: !titleHit && conceptHit ? `핵심 용어 · ${conceptHit}` : "", crumb });
    }
    // 성취기준: 단원 소개의 성취기준 참조
    if (intro) {
      const std = intro.standards?.find((s) => norm(s.code).includes(q) || norm(s.text).includes(q));
      const flat = norm(intro.standard_text).includes(q) || norm(intro.standard_code).includes(q);
      if (std || flat) {
        const text = std ? `${std.code} ${std.text}` : `${intro.standard_code ?? ""} ${intro.standard_text ?? ""}`;
        성취기준.push({ href: `/${k.id}`, title: k.title, snippet: cut(text.trim()), crumb });
      }
    }
  }

  // 영상: 제목 또는 설명
  const 영상: SearchResult[] = [];
  for (const it of index.videos) {
    const k = pubById.get(it.kit_id);
    if (!k) continue;
    const vt = it.video_title || it.title || "";
    if (norm(it.video_title).includes(q) || norm(it.title).includes(q)) {
      영상.push({ href: `/${k.id}/${it.item_key}`, title: vt, snippet: "", crumb: crumbOf(k) });
    } else if (norm(it.video_desc).includes(q)) {
      영상.push({ href: `/${k.id}/${it.item_key}`, title: vt, snippet: cut(it.video_desc!), crumb: crumbOf(k) });
    }
  }

  const cap = (a: SearchResult[]) => a.slice(0, 50);
  const r = { 단원: cap(단원), 영상: cap(영상), 성취기준: cap(성취기준) };
  return { ...r, total: r.단원.length + r.영상.length + r.성취기준.length };
}
