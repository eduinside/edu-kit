import { ensureVisitor, json, readStats, type Ctx } from "../../../_shared";

// GET /api/kits/:id/stats — 조회수·좋아요·이 방문자의 좋아요 여부
export const onRequestGet = async (ctx: Ctx): Promise<Response> => {
  const { vid, isNew } = ensureVisitor(ctx.request);
  const stats = await readStats(ctx.env, ctx.params.id, vid);
  return json(stats, vid, isNew);
};
