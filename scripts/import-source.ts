// 기존 매핑 파일(JSON 배열) → data/raw/*.json 변환 스켈레톤.
// 실행: npm run import   (tsx scripts/import-source.ts)
// 쓰는 법: 아래 SOURCE 경로와 mapKit/mapItems/mapStageMeta 의 TODO만 채운다.
// 생성물은 기존 ETL(sheet-to-json.ts)이 검증·새니타이즈하므로 형식 오류는 빌드에서 걸러진다.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// 기존 매핑 파일 위치(예: 시트를 JSON으로 export). 배열의 한 원소 = 소스 1행.
const SOURCE = resolve(ROOT, "data/source.json");

// 소스 한 행의 타입(실제 컬럼에 맞춰 수정)
interface SourceRow {
  [col: string]: unknown;
}

const rows: SourceRow[] = JSON.parse(readFileSync(SOURCE, "utf8"));

// ── 1) 꾸러미(kits) 만들기 ─────────────────────────────────────────────
// 소스에서 "단원" 단위로 묶어 1꾸러미를 만든다. 아래는 예시 — 실제 컬럼으로 교체.
function mapKits(src: SourceRow[]): unknown[] {
  // TODO: 소스에서 꾸러미 메타 추출. id는 비워 두면 발행 시 자동 부여.
  // 예:
  // const seen = new Map();
  // for (const r of src) {
  //   const key = `${r.grade}-${r.unit}`;
  //   if (!seen.has(key)) seen.set(key, {
  //     id: "", title: String(r.unitTitle), grade: Number(r.grade),
  //     sem: String(r.sem), subject: String(r.subject), unit: String(r.unit),
  //     unit_no: Number(r.unitNo), flow: "activity", sort_order: seen.size + 1, published: false,
  //   });
  // }
  // return [...seen.values()];
  throw new Error("mapKits: 컬럼 매핑을 채우세요 (scripts/import-source.ts)");
}

// ── 2) 항목(items) 만들기 ──────────────────────────────────────────────
function mapItems(src: SourceRow[]): unknown[] {
  // TODO: 소스 행 → items 행. type(intro/video/image/text)·stage·item_key 지정.
  // 영상: video_url(전체 URL). 흐름형: title=핵심용어, video_title=영상제목, video_desc=영상설명.
  // 본문(text): body = 제한 마크다운(### / ** / 표 / :::warn).
  throw new Error("mapItems: 컬럼 매핑을 채우세요");
}

// ── 3) 단계 메타(stage_meta) 만들기 ────────────────────────────────────
function mapStageMeta(src: SourceRow[]): unknown[] {
  // TODO: 활동형의 생각열기/탐구하기/확장하기 탐구질문만. 없으면 [] 반환해도 됨.
  return [];
}

function write(name: string, data: unknown[]) {
  const out = resolve(ROOT, "data/raw", name);
  writeFileSync(out, JSON.stringify(data, null, 2) + "\n");
  console.log(`✓ ${name}: ${data.length}행 → data/raw/${name}`);
}

write("kits.json", mapKits(rows));
write("items.json", mapItems(rows));
write("stage_meta.json", mapStageMeta(rows));
console.log("→ 이제 `npm run sync` 로 검증·변환, `npm run build` 로 확인하세요.");
