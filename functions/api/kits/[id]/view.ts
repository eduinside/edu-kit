import { ensureVisitor, json, readStats, todayUTC, type Ctx } from "../../../_shared";

// POST /api/kits/:id/view — 1인 1일 1회 dedupe 후 조회수 +1 (원자)
export const onRequestPost = async (ctx: Ctx): Promise<Response> => {
  const id = ctx.params.id;
  const { vid, isNew } = ensureVisitor(ctx.request);

  const dedupe = await ctx.env.DB
    .prepare("INSERT OR IGNORE INTO edukit_view_dedupe (kit_id, visitor_id, viewed_on) VALUES (?,?,?)")
    .bind(id, vid, todayUTC())
    .run();

  if (dedupe.meta.changes > 0) {
    await ctx.env.DB
      .prepare("INSERT INTO edukit_stats (kit_id, views, likes) VALUES (?,1,0) ON CONFLICT(kit_id) DO UPDATE SET views=views+1")
      .bind(id)
      .run();
  }

  return json(await readStats(ctx.env, id, vid), vid, isNew);
};
