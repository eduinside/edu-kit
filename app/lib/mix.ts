// 모음(맞춤 목록) — 담은 영상 바구니(이 브라우저 localStorage) + 모음 주소(?i=)·짧은 주소. 계획: docs/FEATURE_PLAN_mix.md
import { useEffect, useState } from "react";

export const MAX_MIX = 30;
const KEY = "edukit:mixBasket";
const EVT = "edukit:basket";

/** 바구니 항목 = "<kit>/<key>" (예: "so4122/v7") */
export const ref = (kitId: string, itemKey: string) => `${kitId}/${itemKey}`;

export function readBasket(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v.filter((s): s is string => typeof s === "string" && /^[A-Za-z0-9]{3,8}\/[A-Za-z0-9_]{1,20}$/.test(s)) : [];
  } catch {
    return [];
  }
}

export function setBasket(list: string[]): void {
  try { localStorage.setItem(KEY, JSON.stringify([...new Set(list)].slice(0, MAX_MIX))); } catch { /* 저장 불가(사생활 모드 등) — 이번 화면에서만 */ }
  window.dispatchEvent(new Event(EVT));
}

/** 담기/빼기. 가득 찼으면 false. */
export function toggleBasket(r: string): boolean {
  const cur = readBasket();
  if (cur.includes(r)) { setBasket(cur.filter((x) => x !== r)); return true; }
  if (cur.length >= MAX_MIX) return false;
  setBasket([...cur, r]);
  return true;
}

export function useBasket(): string[] {
  const [list, setList] = useState<string[]>(() => readBasket());
  useEffect(() => {
    const on = () => setList(readBasket());
    window.addEventListener(EVT, on);
    window.addEventListener("storage", on); // 다른 탭에서 담은 것도 반영
    return () => { window.removeEventListener(EVT, on); window.removeEventListener("storage", on); };
  }, []);
  return list;
}

export interface MixData { id: string | null; title: string; note: string | null; items: string[]; shortUrl: string | null; createdAt: string | null }

// ── 주소에 담는 모음 /m?i=<kit>.<key>,…&t=<제목>[&n=<안내>] — 저장하지 않는다(2026-10-03 결정).
// 수업나래도 같은 주소를 만든다(dge-narae docs/plans/REAL-LIFE-MATERIALS-PLAN.md §2 K3).
export const MIX_TITLE_MAX = 60;
export const MIX_NOTE_MAX = 300;
const QREF = /^[A-Za-z0-9]{3,8}\.[A-Za-z0-9_]{1,20}$/;
const clean = (v: string | null, n: number) => (v ?? "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, n);

/** 바구니 항목("kit/key") → 모음 주소 */
export function mixUrl(body: { title: string; note?: string; items: string[] }, origin = "https://kit.dgedu.link"): string {
  const q = new URLSearchParams();
  q.set("i", body.items.slice(0, MAX_MIX).map((r) => r.replace("/", ".")).join(","));
  q.set("t", clean(body.title, MIX_TITLE_MAX));
  const note = clean(body.note ?? null, MIX_NOTE_MAX);
  if (note) q.set("n", note);
  return `${origin}/m?${mixQuery(q)}`;
}

/** 쿼리 문자열 — 영상 목록의 쉼표는 읽기 쉽게 그대로 둔다(%2C로 바꾸지 않음) */
export const mixQuery = (q: URLSearchParams) => q.toString().replace(/%2C/gi, ",");

/** 모음 주소의 쿼리 → 모음. 형식이 틀린 항목은 버리고, 남는 게 없으면 null. */
export function parseMixQuery(search: string): MixData | null {
  const q = new URLSearchParams(search);
  const items = [...new Set((q.get("i") ?? "").split(",").map((s) => s.trim()).filter((s) => QREF.test(s)))]
    .slice(0, MAX_MIX).map((s) => s.replace(".", "/"));
  if (!items.length) return null;
  return { id: null, title: clean(q.get("t"), MIX_TITLE_MAX) || "수업꾸러미 모음", note: clean(q.get("n"), MIX_NOTE_MAX) || null, items, shortUrl: null, createdAt: null };
}

export interface Shortened { url: string; shortUrl: string | null; qr: string | null }

/** 꾸러미 서버가 dgedu.link로 줄인다. 실패하면 긴 주소만(던지지 않음 — 긴 주소도 그대로 쓸 수 있다). */
export async function shortenMix(url: string, title: string): Promise<Shortened> {
  try {
    const r = await fetch("/api/shorten", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url, title }),
    });
    const d = (await r.json().catch(() => ({}))) as { shortUrl?: string; qr?: string; error?: string };
    if (r.ok && d.shortUrl) return { url, shortUrl: d.shortUrl, qr: d.qr ?? null };
    if (r.status === 429 && d.error) throw new Error(d.error);
  } catch (e) {
    if ((e as Error).message?.includes("오늘은")) throw e;
  }
  return { url, shortUrl: null, qr: null };
}

/** 예전 모음 /m/:id(10/2~10/3 D1 저장분)를 연다 */
export async function getMix(id: string): Promise<MixData | null> {
  const r = await fetch(`/api/mix/${encodeURIComponent(id)}`, { credentials: "same-origin" });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`mix ${r.status}`);
  return (await r.json()) as MixData;
}

/** 짧은 주소가 있으면 dgedu.link의 QR, 없으면 dgedu.link QR API로 꾸러미 주소를 그린다(둘 다 PNG). */
export function qrSrc(mix: { shortUrl: string | null } | null | undefined, url: string): string {
  const slug = mix?.shortUrl?.match(/^https:\/\/dgedu\.link\/([^/?#]+)$/)?.[1];
  return slug ? `https://dgedu.link/qr/${slug}` : `https://dgedu.link/api/v1/qr?data=${encodeURIComponent(url)}`;
}
