// ETL (Cloudflare Pages prebuild): data/raw/*.json(시트 원본) → 검증·변환·새니타이즈 → data/*.json
// 실행: npm run sync   (tsx scripts/sheet-to-json.ts)
// 잘못된 데이터는 throw → 빌드 실패(배포 차단).

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  normalizeRow,
  normalizeStage,
  splitConcepts,
  toBool,
  toInt,
  extractVideoId,
} from "./field-map.ts";
import { markdownToHtml } from "./markdown.ts";
import { assertSafeHtml } from "./sanitize.ts";
import type { Kit, Item, StageMeta } from "./types.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RAW = resolve(ROOT, "data/raw");
const OUT = resolve(ROOT, "data");

const ACTIVITY_STAGES = ["단원안내", "생각열기", "탐구하기", "확장하기"];
const FLOW_STAGES = ["도입", "전개", "정리"];

const KitSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9]{3,8}$/, "id는 3~8자 영숫자"),
  title: z.string().min(1),
  grade: z.union([z.literal(3), z.literal(4), z.literal(5), z.literal(6)]),
  sem: z.enum(["1학기", "2학기"]),
  subject: z.enum(["사회", "과학"]),
  unit: z.string().min(1),
  unit_no: z.number().int().positive(),
  flow: z.enum(["activity", "flow"]),
  sort_order: z.number().int(),
  published: z.boolean(),
});

const ItemSchema = z.object({
  kit_id: z.string().min(1),
  item_key: z.string().regex(/^[A-Za-z0-9_]+$/, "item_key는 영숫자/밑줄"),
  stage: z.string().min(1),
  type: z.enum(["intro", "video", "image", "text"]),
  title: z.string().min(1),
  description: z.string().optional(),
  sort_order: z.number().int(),
  core_idea: z.string().optional(),
  core_question: z.string().optional(),
  concepts: z.array(z.string()).optional(),
  standard_code: z.string().optional(),
  standard_text: z.string().optional(),
  video_url: z.string().optional(),
  video_id: z.string().regex(/^[A-Za-z0-9_-]{11}$/).optional(),
  video_title: z.string().optional(),
  video_desc: z.string().optional(),
  start_sec: z.number().int().nonnegative().optional(),
  end_sec: z.number().int().nonnegative().optional(),
  video_license: z.string().optional(),
  caption: z.string().optional(),
  image_url: z.string().url().optional(),
  image_label: z.string().optional(),
  image_sub: z.string().optional(),
  image_source: z.string().optional(),
  image_license: z.string().optional(),
  body: z.string().optional(),
});

const StageMetaSchema = z.object({
  kit_id: z.string().min(1),
  stage: z.string().min(1),
  question: z.string().nullable(),
  sort_order: z.number().int(),
});

function readRaw(name: string): Record<string, unknown>[] {
  const txt = readFileSync(resolve(RAW, name), "utf8");
  const arr = JSON.parse(txt);
  if (!Array.isArray(arr)) throw new Error(`${name}: 배열이어야 함`);
  return arr.map((r) => normalizeRow(r));
}

function fail(msg: string): never {
  throw new Error(`[sheet-to-json] ${msg}`);
}

function buildKits(): Kit[] {
  return readRaw("kits.json").map((r, idx) => {
    const parsed = {
      ...r,
      grade: toInt(r.grade),
      unit_no: toInt(r.unit_no),
      sort_order: toInt(r.sort_order),
      published: toBool(r.published),
    };
    const res = KitSchema.safeParse(parsed);
    if (!res.success) fail(`kits[${idx}] (${r.id ?? "?"}): ${res.error.issues.map((i) => i.path.join(".") + " " + i.message).join("; ")}`);
    return res.data as Kit;
  });
}

function buildItems(kits: Kit[]): Item[] {
  const flowById = new Map(kits.map((k) => [k.id, k.flow]));
  const seen = new Set<string>();

  const items = readRaw("items.json").map((r, idx) => {
    const stage = normalizeStage(String(r.stage ?? ""));
    const isFlow = flowById.get(String(r.kit_id)) === "flow";

    const base: Record<string, unknown> = {
      ...r,
      stage,
      sort_order: toInt(r.sort_order),
      start_sec: toInt(r.start_sec),
      end_sec: toInt(r.end_sec),
      concepts: typeof r.concepts === "string" ? splitConcepts(r.concepts) : r.concepts,
    };

    // 영상: URL → video_id 추출
    if (base.type === "video") {
      const vid = extractVideoId((base.video_url as string) ?? (base.video_id as string));
      if (!vid) fail(`items[${idx}] (${r.item_key}): 유효한 video_id 추출 실패`);
      base.video_id = vid;
      // 흐름형: description ← video_title (없으면 자동 채움, 의도된 중복)
      if (isFlow && !base.description && base.video_title) {
        base.description = base.video_title;
      }
    }

    // 본문: 마크다운 → HTML → 새니타이즈 게이트
    if (base.type === "text") {
      if (!base.body) fail(`items[${idx}] (${r.item_key}): text 항목에 body 필요`);
      const html = markdownToHtml(String(base.body));
      base.body = assertSafeHtml(html, `items[${idx}] ${r.item_key}`);
    }

    const res = ItemSchema.safeParse(base);
    if (!res.success) fail(`items[${idx}] (${r.item_key}): ${res.error.issues.map((i) => i.path.join(".") + " " + i.message).join("; ")}`);
    const item = res.data;

    // 무결성 검증
    if (!flowById.has(item.kit_id)) fail(`items[${idx}]: 존재하지 않는 kit_id "${item.kit_id}"`);
    const stages = isFlow ? FLOW_STAGES : ACTIVITY_STAGES;
    if (!stages.includes(item.stage)) fail(`items[${idx}] (${item.item_key}): "${item.stage}"는 ${isFlow ? "흐름형" : "활동형"} stage가 아님`);
    const key = `${item.kit_id}/${item.item_key}`;
    if (seen.has(key)) fail(`중복 item_key: ${key}`);
    seen.add(key);

    if (item.type === "intro" && (!item.core_idea || !item.core_question)) {
      fail(`items[${idx}] (${item.item_key}): intro는 core_idea/core_question 필요`);
    }
    if (item.type === "image" && !item.image_url && !item.image_label) {
      fail(`items[${idx}] (${item.item_key}): image는 image_url 또는 image_label 필요`);
    }

    return { id: `${item.kit_id}_${item.item_key}`, ...item } as Item;
  });

  return items;
}

function buildStageMeta(kits: Kit[]): StageMeta[] {
  const ids = new Set(kits.map((k) => k.id));
  return readRaw("stage_meta.json").map((r, idx) => {
    const q = typeof r.question === "string" ? r.question.trim() : r.question;
    const parsed = {
      kit_id: r.kit_id,
      stage: normalizeStage(String(r.stage ?? "")),
      question: q ? String(q) : null, // 빈 문자열 → null
      sort_order: toInt(r.sort_order),
    };
    const res = StageMetaSchema.safeParse(parsed);
    if (!res.success) fail(`stage_meta[${idx}]: ${res.error.issues.map((i) => i.path.join(".") + " " + i.message).join("; ")}`);
    if (!ids.has(res.data.kit_id)) fail(`stage_meta[${idx}]: 존재하지 않는 kit_id "${res.data.kit_id}"`);
    return res.data as StageMeta;
  });
}

function main() {
  const kits = buildKits();

  // id 유일성
  const idSet = new Set<string>();
  for (const k of kits) {
    if (idSet.has(k.id)) fail(`중복 kit id: ${k.id}`);
    idSet.add(k.id);
  }

  const items = buildItems(kits);
  const stageMeta = buildStageMeta(kits);

  kits.sort((a, b) => a.grade - b.grade || a.sort_order - b.sort_order);
  items.sort((a, b) => a.kit_id.localeCompare(b.kit_id) || a.sort_order - b.sort_order);

  mkdirSync(OUT, { recursive: true });
  writeFileSync(resolve(OUT, "kits.json"), JSON.stringify(kits, null, 2) + "\n");
  writeFileSync(resolve(OUT, "items.json"), JSON.stringify(items, null, 2) + "\n");
  writeFileSync(resolve(OUT, "stage_meta.json"), JSON.stringify(stageMeta, null, 2) + "\n");

  console.log(`✓ kits: ${kits.length} (공개 ${kits.filter((k) => k.published).length})`);
  console.log(`✓ items: ${items.length}`);
  console.log(`✓ stage_meta: ${stageMeta.length}`);
  console.log(`→ data/kits.json · items.json · stage_meta.json`);
}

main();
