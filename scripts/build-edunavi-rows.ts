// data/edunavi/guides.json(브라우저 수집 결과) → 시트 붙여넣기용 행 생성.
// 실행: npm run edunavi:rows
// 출력: data/edunavi/out.{kits,items,stage_meta}.tsv (시트에 그대로 붙여넣기) + out.rows.json

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = resolve(ROOT, "data/edunavi");

interface GItem { no: number; keyword: string; cntntsSn: string; title: string; placement: string; stage: string; start: number | null; end: number | null; note: string; youtubeId: string | null; }
interface Guide { chnnlSn?: number; guideSn: number | string; guideTitle?: string; packageSn: string; grade: number | null; sem?: string; subject: string; unit_no?: string; kitTitle?: string; standard_code: string; standard_text: string; purpose: string; keywords: string[]; items: GItem[]; }

const guides: Guide[] = JSON.parse(readFileSync(resolve(DIR, "guides.json"), "utf8"));

const STAGE_ORDER: Record<string, number> = { 단원안내: 1, 생각열기: 2, 탐구하기: 3, 확장하기: 4 };
const KIT_COLS = ["id", "title", "grade", "sem", "subject", "unit", "unit_no", "flow", "sort_order", "published"];
const ITEM_COLS = ["kit_id", "item_key", "stage", "type", "title", "description", "sort_order", "core_idea", "core_question", "concepts", "standard_code", "standard_text", "video_url", "start_sec", "end_sec", "video_title", "video_desc", "video_license", "caption", "image_url", "image_label", "image_sub", "image_source", "image_license", "body"];
const SM_COLS = ["kit_id", "stage", "question", "sort_order"];

const kits: Record<string, unknown>[] = [];
const items: Record<string, unknown>[] = [];
const stageMeta: Record<string, unknown>[] = [];

// 대단원 묶음: 사회 "N-M. 제목" → 대단원 N(=N단원), 차시 M=정렬 / 과학 "N. 제목" → 각 가이드=대단원 N(그대로)
function unitInfo(u: Guide): { unit: string; unit_no: string; sort: number } {
  const t = (u.kitTitle || "").trim();
  if (u.subject === "사회") {
    const m = t.match(/^(\d+)\s*-\s*(\d+)/);
    if (m) return { unit: `${m[1]}단원`, unit_no: m[1]!, sort: Number(m[2]) };
    return { unit: u.unit_no ? `${u.unit_no}단원` : "[대단원]", unit_no: u.unit_no || "", sort: 1 };
  }
  // 과학: "N. 제목" — 가이드 1개 = 대단원 1개(그대로)
  const m = t.match(/^(\d+)\.\s*(.*)$/);
  if (m) return { unit: m[2]!.trim() || `${m[1]}단원`, unit_no: m[1]!, sort: 1 };
  return { unit: t || "[대단원]", unit_no: u.unit_no || "", sort: 1 };
}

guides.forEach((u) => {
  const KIT = `na${u.guideSn}`; // guideSn은 가이드마다 고유 → kit id 충돌 방지(packageSn은 중복 가능)
  const ui = unitInfo(u);
  kits.push({
    id: KIT, title: u.kitTitle || "[단원 제목 입력]", grade: u.grade ?? "[학년]", sem: u.sem || "[학기]",
    subject: u.subject || "[교과]", unit: ui.unit, unit_no: ui.unit_no,
    flow: "activity", sort_order: ui.sort, published: false,
  });

  items.push({
    kit_id: KIT, item_key: "intro", stage: "단원안내", type: "intro", sort_order: 1,
    title: "핵심 아이디어 · 성취기준", description: "이 단원에서 무엇을 배울까요",
    core_idea: u.purpose || u.keywords.join(", ") || "이 단원의 핵심 내용을 살펴봅니다.",
    core_question: u.keywords.length ? `${u.keywords.join("·")}는 무엇이며 어떻게 살펴볼 수 있을까?` : "이 단원에서 무엇을 배울까?",
    concepts: u.keywords.join(" ; "), standard_code: u.standard_code, standard_text: u.standard_text,
  });

  const ord: Record<string, number> = {};
  for (const it of u.items) {
    ord[it.stage] = (ord[it.stage] || 0) + 1;
    const ok = it.youtubeId && /^[A-Za-z0-9_-]{11}$/.test(it.youtubeId);
    const title = it.title || it.keyword || `콘텐츠 ${it.cntntsSn}`; // 빈 제목 폴백(필수)
    const desc = `(${it.keyword})${it.placement ? ` ${it.placement}` : ""}`.trim();
    if (ok) {
      items.push({
        kit_id: KIT, item_key: `v${it.no}`, stage: it.stage, type: "video", sort_order: ord[it.stage],
        title, description: desc,
        video_url: `https://www.youtube.com/watch?v=${it.youtubeId}`,
        start_sec: it.start ?? "", end_sec: it.end ?? "",
        video_title: title, video_desc: it.note,
      });
    } else {
      // 유튜브 미추출(이미지 장면/JS렌더) → image 자리표시자(빌드 안전). 사용자가 확인·교체.
      items.push({
        kit_id: KIT, item_key: `v${it.no}`, stage: it.stage, type: "image", sort_order: ord[it.stage],
        title, description: desc,
        image_label: title, image_sub: it.note,
        caption: `에듀나비 콘텐츠(cntntsSn ${it.cntntsSn}) · 사진/장면 확인 필요`,
      });
    }
  }

  for (const s of [...new Set(u.items.map((i) => i.stage))]) {
    stageMeta.push({ kit_id: KIT, stage: s, question: "", sort_order: STAGE_ORDER[s] ?? 9 });
  }
});

function tsv(cols: string[], rows: Record<string, unknown>[]): string {
  const cell = (v: unknown) => String(v ?? "").replace(/[\t\r\n]+/g, " ");
  return [cols.join("\t"), ...rows.map((r) => cols.map((c) => cell(r[c])).join("\t"))].join("\n") + "\n";
}

// CSV(RFC4180): 쉼표·따옴표·줄바꿈 포함 시 따옴표로 감싸고 내부 따옴표는 2개로.
function csv(cols: string[], rows: Record<string, unknown>[]): string {
  const cell = (v: unknown) => {
    const s = String(v ?? "").replace(/\r?\n/g, " ");
    return /[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\r\n") + "\r\n";
  return "﻿" + body; // 한글 깨짐 방지 BOM
}

writeFileSync(resolve(DIR, "out.kits.tsv"), tsv(KIT_COLS, kits));
writeFileSync(resolve(DIR, "out.items.tsv"), tsv(ITEM_COLS, items));
writeFileSync(resolve(DIR, "out.stage_meta.tsv"), tsv(SM_COLS, stageMeta));
writeFileSync(resolve(DIR, "out.kits.csv"), csv(KIT_COLS, kits));
writeFileSync(resolve(DIR, "out.items.csv"), csv(ITEM_COLS, items));
writeFileSync(resolve(DIR, "out.stage_meta.csv"), csv(SM_COLS, stageMeta));
writeFileSync(resolve(DIR, "out.rows.json"), JSON.stringify({ kits, items, stage_meta: stageMeta }, null, 2) + "\n");

console.log(`✓ 단원 ${kits.length}개 → kits ${kits.length}, items ${items.length}, stage_meta ${stageMeta.length}`);
const vids = items.filter((i) => i.type === "video");
console.log(`  영상 ${vids.length}개 (유튜브 ${vids.filter((i) => String(i.video_url).startsWith("http")).length})`);
console.log(`  → data/edunavi/out.{kits,items,stage_meta}.tsv (시트에 붙여넣기), out.rows.json`);
