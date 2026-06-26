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

export function postView(id: string): Promise<Stats> {
  return fetch(`/api/kits/${id}/view`, { method: "POST", credentials: "same-origin" }).then(asStats);
}

export function postLike(id: string, on: boolean): Promise<Stats> {
  return fetch(`/api/kits/${id}/like`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ on }),
  }).then(asStats);
}
