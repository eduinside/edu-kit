// 디자인 토큰 매핑 — 교과 팔레트, 단계 색, 항목 타입 배지 (프로토타입 SUBJ/STAGE 계승).
import type { CSSProperties } from "react";
import type { ItemType, Stage, Subject } from "../../scripts/types.ts";

// 교과 썸네일 팔레트 [from, to, accent] — sort_order로 회전
export const SUBJECT_PALETTES: Record<Subject, [string, string, string][]> = {
  사회: [
    ["#e0f2fe", "#c7e0ff", "#1f7af0"],
    ["#eef2ff", "#e0e7ff", "#4f46e5"],
    ["#ecfeff", "#cffafe", "#0369a1"],
  ],
  과학: [
    ["#d1fae5", "#a7f3d0", "#059669"],
    ["#f0fdfa", "#ccfbf1", "#0d9488"],
    ["#f0fdf4", "#dcfce7", "#16a34a"],
  ],
};

export function kitPalette(subject: Subject, sortOrder: number): [string, string, string] {
  const pals = SUBJECT_PALETTES[subject] ?? SUBJECT_PALETTES["사회"];
  return pals[(sortOrder - 1) % pals.length]!;
}

export function thumbStyle(subject: Subject, sortOrder: number): CSSProperties {
  const [from, to] = kitPalette(subject, sortOrder);
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

export function stageColor(stage: Stage) {
  return STAGE_COLORS[stage] ?? STAGE_COLORS["단원안내"];
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
