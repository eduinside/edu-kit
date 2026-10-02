// 모음 API 공용(라우트 아님 — 파일명이 _로 시작). 계획: docs/FEATURE_PLAN_mix.md
import type { D1DB } from "../../_shared";

export interface MixEnv {
  DB: D1DB;
  DGEDU_LINK_API_KEY?: string;
}

export const SCHEMA = `CREATE TABLE IF NOT EXISTS edukit_mixes (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  note         TEXT,
  items        TEXT NOT NULL,
  source       TEXT NOT NULL DEFAULT 'kit',
  creator_hash TEXT NOT NULL,
  created_on   TEXT NOT NULL,
  short_slug   TEXT,
  short_url    TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
)`;
let ready = false;
export async function ensureSchema(db: D1DB): Promise<void> {
  if (ready) return;
  await db.prepare(SCHEMA).run();
  ready = true;
}

// 모음을 만들 수 있는 화면 — 꾸러미 사이트, 수업나래, 미리보기·로컬
const ALLOWED = [
  /^https:\/\/kit\.dgedu\.link$/,
  /^https:\/\/narae\.dgedu\.link$/,
  /^https:\/\/[a-z0-9-]+\.edu-kit-br4\.pages\.dev$/,
  /^https:\/\/edu-narae-internal\.eduin\.workers\.dev$/,
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
];
export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin") || "";
  if (!ALLOWED.some((re) => re.test(origin))) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    vary: "origin",
  };
}
export const originAllowed = (request: Request) => {
  const origin = request.headers.get("origin");
  return !origin || ALLOWED.some((re) => re.test(origin)); // Origin 없는 요청(서버 간)은 남용 상한으로만 막는다
};

export function json(request: Request, body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...corsHeaders(request), ...extra },
  });
}

export const preflight = (ctx: { request: Request }) => new Response(null, { status: 204, headers: corsHeaders(ctx.request) });
