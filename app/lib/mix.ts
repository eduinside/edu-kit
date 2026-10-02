// 모음(맞춤 목록) — 담은 영상 바구니(이 브라우저 localStorage) + 모음 API. 계획: docs/FEATURE_PLAN_mix.md
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

export interface MixCreated { id: string; url: string; shortUrl: string | null; qr: string | null }
export interface MixData { id: string; title: string; note: string | null; items: string[]; shortUrl: string | null; createdAt: string }

export async function createMix(body: { title: string; note?: string; items: string[] }): Promise<MixCreated> {
  const r = await fetch("/api/mix", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...body, source: "kit" }),
  });
  const d = (await r.json().catch(() => ({}))) as Partial<MixCreated> & { error?: string };
  if (!r.ok || !d.id) throw new Error(d.error || "모음을 만들지 못했어요. 잠시 뒤 다시 해 주세요.");
  return d as MixCreated;
}

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
