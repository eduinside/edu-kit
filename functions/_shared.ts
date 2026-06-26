// Cloudflare Pages Functions 공용 — 공유 D1(edu-link-db)의 edukit_* 카운터.
// 파일명이 _로 시작하므로 라우트가 아니라 import 전용.

// D1의 사용 부분집합만 구조적으로 선언(@cloudflare/workers-types 의존 회피).
export interface D1Result {
  meta: { changes: number };
}
export interface D1Stmt {
  bind(...values: unknown[]): D1Stmt;
  first<T = Record<string, unknown>>(colName?: string): Promise<T | null>;
  run(): Promise<D1Result>;
}
export interface D1DB {
  prepare(query: string): D1Stmt;
}
export interface Env {
  DB: D1DB;
}

export interface Stats {
  views: number;
  likes: number;
  liked: boolean;
}

const COOKIE = "ek_vid";

export function ensureVisitor(request: Request): { vid: string; isNew: boolean } {
  const cookie = request.headers.get("cookie") || "";
  const m = cookie.match(/(?:^|;\s*)ek_vid=([A-Za-z0-9-]+)/);
  if (m) return { vid: m[1]!, isNew: false };
  return { vid: crypto.randomUUID(), isNew: true };
}

export function todayUTC(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

export function json(data: unknown, vid: string, isNew: boolean): Response {
  const headers: Record<string, string> = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  };
  if (isNew) {
    headers["set-cookie"] = `${COOKIE}=${vid}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`;
  }
  return new Response(JSON.stringify(data), { headers });
}

/** 현재 집계 + 이 방문자의 좋아요 여부 */
export async function readStats(env: Env, id: string, vid: string): Promise<Stats> {
  const s = await env.DB.prepare("SELECT views, likes FROM edukit_stats WHERE kit_id=?")
    .bind(id)
    .first<{ views: number; likes: number }>();
  const liked = await env.DB.prepare("SELECT 1 AS x FROM edukit_likes WHERE kit_id=? AND visitor_id=?")
    .bind(id, vid)
    .first();
  return { views: s?.views ?? 0, likes: s?.likes ?? 0, liked: !!liked };
}

export interface Ctx {
  request: Request;
  env: Env;
  params: { id: string };
}
