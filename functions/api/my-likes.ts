import { ensureVisitor, type Env } from "../_shared";

// GET /api/my-likes — 이 방문자(ek_vid 쿠키)가 좋아요한 꾸러미 id 목록(최근순).
// 쿠키가 없으면(첫 방문) 빈 목록. 방문자별이라 캐시하지 않음.
interface Row {
  kit_id: string;
}

export const onRequestGet = async (ctx: { request: Request; env: Env }): Promise<Response> => {
  const { vid, isNew } = ensureVisitor(ctx.request);
  let ids: string[] = [];
  if (!isNew) {
    const res = await ctx.env.DB.prepare(
      "SELECT kit_id FROM edukit_likes WHERE visitor_id=? ORDER BY created_at DESC"
    ).bind(vid).all<Row>();
    ids = (res.results ?? []).map((r) => r.kit_id);
  }
  return new Response(JSON.stringify({ ids }), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
};
