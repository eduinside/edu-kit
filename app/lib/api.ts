// 런타임 카운터 API 클라이언트 (Pages Functions). 실패 시 호출측이 시드로 폴백.
export interface Stats {
  views: number;
  likes: number;
  liked: boolean;
}

async function asStats(r: Response): Promise<Stats> {
  if (!r.ok) throw new Error(`stats ${r.status}`);
  return (await r.json()) as Stats;
}

export function getStats(id: string): Promise<Stats> {
  return fetch(`/api/kits/${id}/stats`, { credentials: "same-origin" }).then(asStats);
}

// 홈 카드용 — 전체 꾸러미 조회수·좋아요 일괄. 실패 시 호출측이 폴백(시드/0).
export type StatsMap = Record<string, { views: number; likes: number }>;
export function getAllStats(): Promise<StatsMap> {
  return fetch(`/api/stats`, { credentials: "same-origin" }).then((r) => {
    if (!r.ok) throw new Error(`stats ${r.status}`);
    return r.json() as Promise<StatsMap>;
  });
}

// 이 브라우저(방문자 쿠키)가 좋아요한 꾸러미 id 목록(최근순). 실패 시 호출측이 빈 목록 폴백.
export function getMyLikes(): Promise<string[]> {
  return fetch(`/api/my-likes`, { credentials: "same-origin" }).then((r) => {
    if (!r.ok) throw new Error(`my-likes ${r.status}`);
    return (r.json() as Promise<{ ids: string[] }>).then((d) => d.ids ?? []);
  });
}

export function postView(id: string): Promise<Stats> {
  return fetch(`/api/kits/${id}/view`, { method: "POST", credentials: "same-origin" }).then(asStats);
}

// 영상 "문제 알리기"(docs/FEATURE_PLAN_report.md). 실패하면 던진다 — 호출측이 안내 문구를 보인다.
export type ReportReason = "play" | "inappropriate" | "other";
export async function postReport(kitId: string, body: {
  item: string; reason: ReportReason; note?: string; kitTitle?: string; itemTitle?: string; videoId?: string; website?: string;
}): Promise<void> {
  const r = await fetch(`/api/kits/${kitId}/report`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const msg = await r.json().then((d: { error?: string }) => d.error).catch(() => undefined);
    throw new Error(msg || "보내지 못했어요. 잠시 뒤 다시 해 주세요.");
  }
}

export function postLike(id: string, on: boolean): Promise<Stats> {
  return fetch(`/api/kits/${id}/like`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ on }),
  }).then(asStats);
}
