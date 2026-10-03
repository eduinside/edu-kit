import { todayUTC, type D1DB } from "../_shared";

// POST /api/shorten — 꾸러미 사이트 「모음 주소 만들기」가 만든 모음 주소(/m?i=…)를 dgedu.link로 줄인다.
// 모음 자체는 저장하지 않는다(주소가 곧 모음, 2026-10-03 결정). 같은 주소는 한 번만 줄이고 다시 돌려준다.
// 수업나래는 자기 서버에서 직접 줄이므로 이 함수를 부르지 않는다(dge-narae REAL-LIFE-MATERIALS-PLAN §2 K4). 계획: docs/FEATURE_PLAN_mix.md

interface Env { DB: D1DB; DGEDU_LINK_API_KEY?: string }
interface Ctx { request: Request; env: Env }

const PER_CREATOR_DAILY = 30;
const MIX_URL = /^https:\/\/kit\.dgedu\.link\/m\?[A-Za-z0-9%._~&=+,-]{1,4000}$/;
// 같은 사이트에서만(꾸러미·미리보기·로컬)
const SAME_SITE = [
  /^https:\/\/kit\.dgedu\.link$/,
  /^https:\/\/[a-z0-9-]+\.edu-kit-br4\.pages\.dev$/,
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
];

const SCHEMA = `CREATE TABLE IF NOT EXISTS edukit_shortens (
  url          TEXT PRIMARY KEY,
  short_slug   TEXT NOT NULL,
  short_url    TEXT NOT NULL,
  creator_hash TEXT NOT NULL,
  created_on   TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
)`;
let ready = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const clip = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f]/g, "").trim().slice(0, n) : "");

async function hashCreator(request: Request, today: string): Promise<string> {
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "local";
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${ip}|${today}|edukit-mix`));
  return Array.from(new Uint8Array(buf).slice(0, 8), (b) => b.toString(16).padStart(2, "0")).join(""); // 원래 IP는 저장하지 않는다
}

export const onRequestPost = async ({ request, env }: Ctx): Promise<Response> => {
  const origin = request.headers.get("origin");
  if (!origin || !SAME_SITE.some((re) => re.test(origin))) return json({ error: "허용되지 않은 곳에서 온 요청이에요" }, 403);

  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; } catch { return json({ error: "형식이 맞지 않아요" }, 400); }
  const url = typeof body.url === "string" ? body.url : "";
  const title = clip(body.title, 60) || "모음";
  if (!MIX_URL.test(url)) return json({ error: "모음 주소가 아니에요" }, 400);
  if (!env.DGEDU_LINK_API_KEY) return json({ shortUrl: null, qr: null });

  if (!ready) { await env.DB.prepare(SCHEMA).run(); ready = true; }
  const seen = await env.DB.prepare("SELECT short_slug, short_url FROM edukit_shortens WHERE url=?").bind(url).first<{ short_slug: string; short_url: string }>();
  if (seen) return json({ shortUrl: seen.short_url, qr: `https://dgedu.link/qr/${seen.short_slug}` });

  const today = todayUTC();
  const creator = await hashCreator(request, today);
  const made = await env.DB.prepare("SELECT COUNT(*) AS n FROM edukit_shortens WHERE creator_hash=? AND created_on=?").bind(creator, today).first<{ n: number }>();
  if ((made?.n ?? 0) >= PER_CREATOR_DAILY) return json({ error: "오늘은 짧은 주소를 더 만들 수 없어요. 긴 주소를 그대로 쓰거나 내일 다시 해 주세요." }, 429);

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const items = new URL(url).searchParams.get("i")?.split(",").length ?? 0;
    const r = await fetch("https://dgedu.link/api/v1/shorten", {
      method: "POST",
      signal: ctrl.signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${env.DGEDU_LINK_API_KEY}` },
      body: JSON.stringify({ original_url: url, title: `수업꾸러미 모음 · ${title}`, description: `영상 ${items}개 · 수업꾸러미에서 만듦` }),
    });
    clearTimeout(timer);
    const d = (await r.json().catch(() => ({}))) as { success?: boolean; slug?: string; short_url?: string };
    if (!r.ok || !d.success || !d.slug || !d.short_url) return json({ shortUrl: null, qr: null });
    await env.DB.prepare("INSERT OR IGNORE INTO edukit_shortens (url, short_slug, short_url, creator_hash, created_on) VALUES (?,?,?,?,?)")
      .bind(url, d.slug, d.short_url, creator, today).run();
    return json({ shortUrl: d.short_url, qr: `https://dgedu.link/qr/${d.slug}` });
  } catch {
    return json({ shortUrl: null, qr: null }); // 짧은 주소 없이 긴 주소만
  }
};
