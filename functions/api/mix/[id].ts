import { ensureSchema, json, preflight, type MixEnv } from "./_mix";

// GET /api/mix/:id — 모음 하나(제목·안내·영상 목록·짧은 주소). 모음은 만든 뒤 바뀌지 않으므로 잠시 캐시한다.

interface Ctx { request: Request; env: MixEnv; params: { id: string } }

export const onRequestOptions = preflight;

export const onRequestGet = async (ctx: Ctx): Promise<Response> => {
  const { request, env, params } = ctx;
  if (!/^[a-z0-9]{6}$/.test(params.id)) return json(request, { error: "없는 모음이에요" }, 404);
  await ensureSchema(env.DB);
  const row = await env.DB
    .prepare("SELECT id, title, note, items, short_url, created_at FROM edukit_mixes WHERE id=?")
    .bind(params.id)
    .first<{ id: string; title: string; note: string | null; items: string; short_url: string | null; created_at: string }>();
  if (!row) return json(request, { error: "없는 모음이에요" }, 404);
  let items: string[] = [];
  try { items = JSON.parse(row.items) as string[]; } catch { /* 깨진 행 — 빈 목록 */ }
  return json(request, { id: row.id, title: row.title, note: row.note, items, shortUrl: row.short_url, createdAt: row.created_at }, 200, {
    "cache-control": "public, max-age=300",
  });
};
