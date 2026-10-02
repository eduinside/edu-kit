import { todayUTC } from "../../_shared";
import { ensureSchema, json, originAllowed, preflight, type MixEnv } from "./_mix";

// POST /api/mix — 모음 만들기. D1 edukit_mixes에 저장하고, 키가 있으면 dgedu.link 짧은 주소를 만든다.
// 꾸러미 사이트와 수업나래(CORS)가 부른다. 계획: docs/FEATURE_PLAN_mix.md

interface Ctx { request: Request; env: MixEnv }

const MAX_ITEMS = 30;
const PER_CREATOR_DAILY = 30;
const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz"; // 헷갈리는 0·1·i·l·o 뺌
const REF = /^[A-Za-z0-9]{3,8}\/[A-Za-z0-9_]{1,20}$/;

const clip = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, n) : "");
const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => ALPHABET[b % ALPHABET.length]).join("");

async function hashCreator(request: Request, today: string): Promise<string> {
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "local";
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${ip}|${today}|edukit-mix`));
  return Array.from(new Uint8Array(buf).slice(0, 8), (b) => b.toString(16).padStart(2, "0")).join(""); // 원래 IP는 저장하지 않는다
}

export const onRequestOptions = preflight;

export const onRequestPost = async (ctx: Ctx): Promise<Response> => {
  const { request, env } = ctx;
  if (!originAllowed(request)) return json(request, { error: "허용되지 않은 곳에서 온 요청이에요" }, 403);

  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; } catch { return json(request, { error: "형식이 맞지 않아요" }, 400); }

  const title = clip(body.title, 60);
  const note = clip(body.note, 300);
  const source = clip(body.source, 10) === "narae" ? "narae" : "kit";
  const items = Array.isArray(body.items) ? [...new Set(body.items.filter((x): x is string => typeof x === "string" && REF.test(x)))] : [];
  if (!title) return json(request, { error: "모음 제목을 적어 주세요" }, 400);
  if (!items.length) return json(request, { error: "담은 영상이 없어요" }, 400);
  if (items.length > MAX_ITEMS) return json(request, { error: `모음에는 영상을 ${MAX_ITEMS}개까지 담을 수 있어요` }, 400);

  const today = todayUTC();
  const creator = await hashCreator(request, today);
  await ensureSchema(env.DB);
  const made = await env.DB.prepare("SELECT COUNT(*) AS n FROM edukit_mixes WHERE creator_hash=? AND created_on=?").bind(creator, today).first<{ n: number }>();
  if ((made?.n ?? 0) >= PER_CREATOR_DAILY) return json(request, { error: "오늘은 모음을 더 만들 수 없어요. 내일 다시 해 주세요." }, 429);

  let id = "";
  for (let i = 0; i < 5 && !id; i++) {
    const cand = newId();
    const res = await env.DB
      .prepare("INSERT OR IGNORE INTO edukit_mixes (id, title, note, items, source, creator_hash, created_on) VALUES (?,?,?,?,?,?,?)")
      .bind(cand, title, note || null, JSON.stringify(items), source, creator, today)
      .run();
    if (res.meta.changes > 0) id = cand;
  }
  if (!id) return json(request, { error: "모음을 만들지 못했어요. 다시 해 주세요." }, 500);

  const url = `https://kit.dgedu.link/m/${id}`;
  let shortUrl: string | null = null, slug: string | null = null;
  if (env.DGEDU_LINK_API_KEY) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 5000);
      const r = await fetch("https://dgedu.link/api/v1/shorten", {
        method: "POST",
        signal: ctrl.signal,
        headers: { "content-type": "application/json", authorization: `Bearer ${env.DGEDU_LINK_API_KEY}` },
        body: JSON.stringify({ original_url: url, title: `수업꾸러미 모음 · ${title}`, description: `영상 ${items.length}개 · ${source === "narae" ? "수업나래" : "수업꾸러미"}에서 만듦` }),
      });
      clearTimeout(timer);
      const d = (await r.json().catch(() => ({}))) as { success?: boolean; slug?: string; short_url?: string };
      if (r.ok && d.success && d.slug && d.short_url) {
        slug = d.slug; shortUrl = d.short_url;
        await env.DB.prepare("UPDATE edukit_mixes SET short_slug=?, short_url=? WHERE id=?").bind(slug, shortUrl, id).run();
      }
    } catch { /* 짧은 주소 없이 꾸러미 주소만 */ }
  }

  return json(request, { id, url, shortUrl, qr: slug ? `https://dgedu.link/qr/${slug}` : null }, 201);
};
