import { ensureVisitor, json, readStats, type Ctx } from "../../../_shared";

// POST /api/kits/:id/like  body: { on: boolean } — 1인 1표 멱등 토글
export const onRequestPost = async (ctx: Ctx): Promise<Response> => {
  const id = ctx.params.id;
  const { vid, isNew } = ensureVisitor(ctx.request);
  const body = (await ctx.request.json().catch(() => ({}))) as { on?: boolean };
  const on = !!body.on;

  if (on) {
    const r = await ctx.env.DB
      .prepare("INSERT OR IGNORE INTO edukit_likes (kit_id, visitor_id) VALUES (?,?)")
      .bind(id, vid)
      .run();
    if (r.meta.changes > 0) {
      await ctx.env.DB
        .prepare("INSERT INTO edukit_stats (kit_id, views, likes) VALUES (?,0,1) ON CONFLICT(kit_id) DO UPDATE SET likes=likes+1")
        .bind(id)
        .run();
    }
  } else {
    const r = await ctx.env.DB
      .prepare("DELETE FROM edukit_likes WHERE kit_id=? AND visitor_id=?")
      .bind(id, vid)
      .run();
    if (r.meta.changes > 0) {
      await ctx.env.DB
        .prepare("UPDATE edukit_stats SET likes=MAX(0, likes-1) WHERE kit_id=?")
        .bind(id)
        .run();
    }
  }

  return json(await readStats(ctx.env, id, vid), vid, isNew);
};
