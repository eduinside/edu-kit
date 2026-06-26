// 시트/프로토타입 헤더 → 정본 필드명 매핑 (단일 소스).
// 정본은 DATA_MODEL.md. 시트는 가급적 정본 컬럼명을 그대로 쓰되,
// 프로토타입 별칭(dae, ready, html …)도 받아들여 정규화한다.

export const HEADER_ALIASES: Record<string, string> = {
  // 공통
  dae: "unit",
  daeNo: "unit_no",
  ready: "published",
  order: "sort_order",
  // items
  imgLabel: "image_label",
  imgSub: "image_sub",
  html: "body",
  vTitle: "video_title",
  vDesc: "video_desc",
  videoId: "video_id",
  keyword: "title", // 흐름형 핵심용어는 title로 정규화(별도 컬럼 없음)
};

/** 한 행(헤더→값)을 정본 키로 정규화. 공백 트림, 빈 문자열은 제거. */
export function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [rawKey, rawVal] of Object.entries(row)) {
    const key = (HEADER_ALIASES[rawKey.trim()] ?? rawKey.trim());
    const val = typeof rawVal === "string" ? rawVal.trim() : rawVal;
    if (val === "" || val === null || val === undefined) continue;
    out[key] = val;
  }
  return out;
}

/** stage 라벨 정규화 — 정본은 공백 없음('단원 안내' → '단원안내'). */
export function normalizeStage(s: string): string {
  return s.replace(/\s+/g, "");
}

/** "구석기·신석기 ; 농경과 정착" → ["구석기·신석기", "농경과 정착"] */
export function splitConcepts(s: string | undefined): string[] | undefined {
  if (!s) return undefined;
  const arr = s
    .split(";")
    .map((x) => x.trim())
    .filter(Boolean);
  return arr.length ? arr : undefined;
}

/** boolean 셀 정규화: true/1/✓/공개/Y → true */
export function toBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  const s = String(v ?? "").trim().toLowerCase();
  return ["true", "1", "✓", "y", "yes", "공개", "o"].includes(s);
}

/** 정수 셀 정규화 */
export function toInt(v: unknown): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

/** 전체 YouTube URL 또는 11자 id → 11자 video_id */
export function extractVideoId(urlOrId: string | undefined): string | undefined {
  if (!urlOrId) return undefined;
  const s = urlOrId.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  const m = s.match(
    /(?:youtu\.be\/|v=|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{11})/
  );
  return m ? m[1] : undefined;
}
