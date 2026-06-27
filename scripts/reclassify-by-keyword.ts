// 발행된 data/raw/*.json(중복단원 정리본)을 "핵심 용어 흐름형"으로 재분류한다.
// - 수업단계(생각열기/탐구하기/확장하기) 대신 항목 제목의 (핵심어)로 그룹화.
// - kit.flow = "flow"(핵심 용어 흐름), 항목 stage = 핵심어, stage_meta = 핵심어별 1행.
// 실행: npm run reclassify
// 출력: data/edunavi/reclass.{kits,items,stage_meta}.{csv,tsv} (시트에 붙여넣기)

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RAW = resolve(ROOT, "data/raw");
const OUT = resolve(ROOT, "data/edunavi");

const KIT_COLS = ["id", "title", "grade", "sem", "subject", "unit", "unit_no", "flow", "sort_order", "published"];
const ITEM_COLS = ["kit_id", "item_key", "stage", "type", "title", "description", "sort_order", "core_idea", "core_question", "concepts", "standard_code", "standard_text", "video_url", "start_sec", "end_sec", "video_title", "video_desc", "video_license", "caption", "image_url", "image_label", "image_sub", "image_source", "image_license", "body"];
const SM_COLS = ["kit_id", "stage", "question", "sort_order"];

type Row = Record<string, unknown>;
const readRaw = (n: string): Row[] => JSON.parse(readFileSync(resolve(RAW, n), "utf8"));

const kitsRaw = readRaw("kits.json");
const itemsRaw = readRaw("items.json");

const ETC = "기타";

// 제목 앞 (핵심어[, 핵심어…]) → 핵심어 배열. 없으면 [].
function keywordsOf(desc: unknown): string[] {
  const m = String(desc ?? "").match(/^\(([^)]*)\)/);
  if (!m) return [];
  return m[1].split(/\s*,\s*/).map((s) => s.trim()).filter(Boolean);
}

// 항목이 속할 대표 핵심어: concepts 순서상 가장 앞선 키워드, 없으면 첫 키워드, 그것도 없으면 기타.
function primaryKeyword(desc: unknown, concepts: string[]): string {
  const kws = keywordsOf(desc);
  if (!kws.length) return ETC;
  let best: string | null = null, bestIdx = Infinity;
  for (const k of kws) { const i = concepts.indexOf(k); if (i >= 0 && i < bestIdx) { bestIdx = i; best = k; } }
  return best ?? kws[0]!;
}

const outKits: Row[] = [];
const outItems: Row[] = [];
const outMeta: Row[] = [];
let multiCount = 0, etcCount = 0;
const multiSamples: string[] = [];

for (const kit of kitsRaw) {
  const kid = String(kit.id);
  outKits.push({ ...kit, flow: "flow" }); // 핵심 용어 흐름형으로 전환

  const its = itemsRaw.filter((i) => i.kit_id === kid);
  const intro = its.find((i) => i.type === "intro");
  const concepts = intro ? String(intro.concepts ?? "").split(/\s*;\s*/).map((s) => s.trim()).filter(Boolean) : [];

  // 핵심어별 그룹(원본 행 순서 보존). intro는 단원안내로 별도 유지.
  const groups = new Map<string, Row[]>();
  for (const it of its) {
    if (it.type === "intro") continue;
    const pk = primaryKeyword(it.description, concepts);
    if (keywordsOf(it.description).length > 1) { multiCount++; if (multiSamples.length < 6) multiSamples.push(`${kid}/${it.item_key} "${it.description}" → ${pk}`); }
    if (pk === ETC) etcCount++;
    (groups.get(pk) ?? groups.set(pk, []).get(pk)!).push(it);
  }

  // 그룹 순서: concepts에 있는 핵심어를 concepts 순으로, 나머지(기타·비표준)는 첫 등장 순으로 뒤에.
  // concepts에 중복(예: na1685 "경제활동" 2회)이 있어도 그룹은 한 번만 — Set으로 중복 제거.
  const used = [...groups.keys()];
  const order = [...new Set([
    ...concepts.filter((c) => groups.has(c)),
    ...used.filter((k) => !concepts.includes(k)),
  ])];

  // intro 먼저
  if (intro) outItems.push({ ...intro, stage: "단원안내", sort_order: 1 });

  order.forEach((kw, gi) => {
    outMeta.push({ kit_id: kid, stage: kw, question: "", sort_order: gi + 1 });
    groups.get(kw)!.forEach((it, idx) => {
      outItems.push({ ...it, stage: kw, sort_order: idx + 1 }); // 그룹 내 원본 순서 유지
    });
  });
}

function cellTsv(v: unknown) { return String(v ?? "").replace(/[\t\r\n]+/g, " "); }
function tsv(cols: string[], rows: Row[]) {
  return [cols.join("\t"), ...rows.map((r) => cols.map((c) => cellTsv(r[c])).join("\t"))].join("\n") + "\n";
}
function cellCsv(v: unknown) {
  const s = String(v ?? "").replace(/\r?\n/g, " ");
  return /[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function csv(cols: string[], rows: Row[]) {
  return "﻿" + [cols.join(","), ...rows.map((r) => cols.map((c) => cellCsv(r[c])).join(","))].join("\r\n") + "\r\n";
}

writeFileSync(resolve(OUT, "reclass.kits.tsv"), tsv(KIT_COLS, outKits));
writeFileSync(resolve(OUT, "reclass.items.tsv"), tsv(ITEM_COLS, outItems));
writeFileSync(resolve(OUT, "reclass.stage_meta.tsv"), tsv(SM_COLS, outMeta));
writeFileSync(resolve(OUT, "reclass.kits.csv"), csv(KIT_COLS, outKits));
writeFileSync(resolve(OUT, "reclass.items.csv"), csv(ITEM_COLS, outItems));
writeFileSync(resolve(OUT, "reclass.stage_meta.csv"), csv(SM_COLS, outMeta));
// JSON(검증용: data/raw에 임시 복사해 npm run sync 확인 가능)
writeFileSync(resolve(OUT, "reclass.kits.json"), JSON.stringify(outKits, null, 2) + "\n");
writeFileSync(resolve(OUT, "reclass.items.json"), JSON.stringify(outItems, null, 2) + "\n");
writeFileSync(resolve(OUT, "reclass.stage_meta.json"), JSON.stringify(outMeta, null, 2) + "\n");

const groupTotal = outMeta.length;
console.log(`✓ 재분류 완료(핵심 용어 흐름형)`);
console.log(`  kits ${outKits.length} · items ${outItems.length} · stage_meta(핵심어 그룹) ${groupTotal}`);
console.log(`  다중 핵심어 항목 ${multiCount}개 → 첫 핵심어 그룹에 배치(설명에 원본 태그 유지)`);
console.log(`  핵심어 미상 항목 ${etcCount}개 → "${ETC}" 그룹`);
if (multiSamples.length) console.log(`  다중 예: ${multiSamples.join(" | ")}`);
console.log(`  → data/edunavi/reclass.{kits,items,stage_meta}.csv (시트에 붙여넣기)`);
