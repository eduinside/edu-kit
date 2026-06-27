// 디자인 토큰 매핑 — 교과 팔레트, 단계 색, 항목 타입 배지 (프로토타입 SUBJ/STAGE 계승).
import type { CSSProperties } from "react";
import type { ItemType, Stage } from "../../scripts/types.ts";

// 단원(unit_no)별 썸네일 팔레트 [from, to, accent] — 같은 단원은 같은 색.
// 1단원 연두 → 2 하늘색 → 3 진한 청색 → 4 연보라 (현행 교육과정: 사회 ≤3단원·과학 ≤4단원, 5~6은 예비)
export const UNIT_PALETTES: [string, string, string][] = [
  ["#ecfccb", "#d9f99d", "#4d7c0f"], // 1단원 · 연두(라임)
  ["#e0f2fe", "#bae6fd", "#0369a1"], // 2단원 · 하늘색
  ["#bfdbfe", "#93c5fd", "#1e40af"], // 3단원 · 진한 청색
  ["#ede9fe", "#ddd6fe", "#6d28d9"], // 4단원 · 연보라
  ["#fbcfe8", "#f9a8d4", "#be185d"], // 5단원 · 분홍(예비)
  ["#fde68a", "#fcd34d", "#b45309"], // 6단원 · 호박(예비)
];

export function unitPalette(unitNo: number): [string, string, string] {
  const i = (Math.max(1, Math.floor(unitNo || 1)) - 1) % UNIT_PALETTES.length;
  return UNIT_PALETTES[i]!;
}

export function thumbStyle(unitNo: number): CSSProperties {
  const [from, to] = unitPalette(unitNo);
  return {
    position: "relative",
    aspectRatio: "16 / 9",
    overflow: "hidden",
    background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
  };
}

// 단계 색 (soft 배경 / text)
export const STAGE_COLORS: Record<Stage, { soft: string; text: string }> = {
  단원안내: { soft: "var(--color-slate-100)", text: "var(--color-slate-600)" },
  생각열기: { soft: "var(--color-warning-50)", text: "var(--color-warning-700)" },
  탐구하기: { soft: "var(--color-brand-50)", text: "var(--color-brand-700)" },
  확장하기: { soft: "var(--color-success-50)", text: "var(--color-success-700)" },
  도입: { soft: "#f0f9ff", text: "#0369a1" },
  전개: { soft: "var(--color-brand-50)", text: "var(--color-brand-700)" },
  정리: { soft: "var(--color-success-50)", text: "var(--color-success-700)" },
};

// 흐름형(핵심 용어) stage는 고정 단계가 아니므로, 용어 문자열을 해시해 안정적으로 색을 회전 배정.
const KEYTERM_COLORS: { soft: string; text: string }[] = [
  { soft: "var(--color-brand-50)", text: "var(--color-brand-700)" },
  { soft: "var(--color-warning-50)", text: "var(--color-warning-700)" },
  { soft: "var(--color-success-50)", text: "var(--color-success-700)" },
  { soft: "var(--color-violet-50)", text: "var(--color-violet-700)" },
  { soft: "#fdf2f8", text: "#be185d" },
  { soft: "#ecfeff", text: "#0e7490" },
];

function hashStage(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0;
  return h;
}

// 고정 단계는 이름으로, 흐름형 핵심 용어는 그룹 순서(order)로 색 배정해 한 꾸러미 안에서 충돌 없이 회전.
// order 미제공 시 용어 해시로 안정 폴백.
export function stageColor(stage: Stage, order?: number) {
  if (STAGE_COLORS[stage]) return STAGE_COLORS[stage];
  const idx = order && order > 0 ? order - 1 : hashStage(stage);
  return KEYTERM_COLORS[idx % KEYTERM_COLORS.length]!;
}

// 항목 타입 배지
export const TYPE_BADGE: Record<ItemType, { label: string; soft: string; text: string }> = {
  video: { label: "영상", soft: "var(--color-brand-50)", text: "var(--color-brand-700)" },
  image: { label: "이미지", soft: "var(--color-violet-50)", text: "var(--color-violet-700)" },
  intro: { label: "개요", soft: "var(--color-slate-100)", text: "var(--color-slate-500)" },
  text: { label: "글", soft: "var(--color-success-50)", text: "var(--color-success-700)" },
};

export function flowLabel(flow: string): string {
  return flow === "flow" ? "핵심 용어 흐름" : "학습 흐름";
}
