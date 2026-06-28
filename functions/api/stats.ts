import type { Env } from "../_shared";

// GET /api/stats — 전체 꾸러미 조회수·좋아요 일괄(홈 카드용). 방문자별 liked는 불필요 → 캐시 가능.
// 반환: { "<kit_id>": { views, likes }, ... }  (집계 행이 없는 꾸러미는 키 없음 = 0으로 취급)
interface Row {
  kit_id: string;
  views: number;
  likes: number;
}

export const onRequestGet = async (ctx: { env: Env }): Promise<Response> => {
  const res = await ctx.env.DB.prepare("SELECT kit_id, views, likes FROM edukit_stats").all<Row>();
  const out: Record<string, { views: number; likes: number }> = {};
  for (const r of res.results ?? []) out[r.kit_id] = { views: r.views, likes: r.likes };
  return new Response(JSON.stringify(out), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=60", // 홈 카드 — 1분 캐시로 D1 부하 완화
    },
  });
};
