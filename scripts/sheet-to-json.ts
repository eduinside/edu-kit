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
import { generateUniqueId } from "./shortid.ts";
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

// 결손/이상 행은 빌드를 깨지 않고 폴백·건너뜀 + 경고(빌드 로그에 남음). 대량 임포트 회복력.
let _warnCount = 0;
function warn(msg: string): void {
  _warnCount++;
  console.warn(`⚠ [sheet-to-json] ${msg}`);
}

function buildKits(): Kit[] {
  const rows = readRaw("kits.json");
  const ids = new Set<string>(rows.map((r) => String(r.id ?? "").trim()).filter(Boolean));
  const used = new Set<string>();
  const out: Kit[] = [];
  rows.forEach((r, idx) => {
    if (!r.id) {
      const id = generateUniqueId(ids);
      ids.add(id);
      r.id = id;
      warn(`kits[${idx}] id 비어 자동 생성: ${id}`);
    }
    const parsed = {
      ...r,
      grade: toInt(r.grade),
      unit_no: toInt(r.unit_no),
      sort_order: toInt(r.sort_order),
      published: toBool(r.published),
    };
    const res = KitSchema.safeParse(parsed);
    if (!res.success) {
      warn(`kits[${idx}] (${r.id}) 건너뜀: ${res.error.issues.map((i) => i.path.join(".") + " " + i.message).join("; ")}`);
      return;
    }
    const kit = res.data as Kit;
    if (used.has(kit.id)) {
      warn(`kits[${idx}] 중복 id "${kit.id}" → 건너뜀(첫 항목 유지)`);
      return;
    }
    used.add(kit.id);
    out.push(kit);
  });
  return out;
}

function buildItems(kits: Kit[]): Item[] {
  const flowById = new Map(kits.map((k) => [k.id, k.flow]));
  const seen = new Set<string>();

  const items = readRaw("items.json").map((r, idx) => {
    const stage = normalizeStage(String(r.stage ?? ""));
    const isFlow = flowById.get(String(r.kit_id)) === "flow";
    const key0 = `${r.kit_id ?? "?"}/${r.item_key ?? idx}`;

    const base: Record<string, unknown> = {
      ...r,
      stage,
      sort_order: toInt(r.sort_order),
      start_sec: toInt(r.start_sec),
      end_sec: toInt(r.end_sec),
      concepts: typeof r.concepts === "string" ? splitConcepts(r.concepts) : r.concepts,
    };

    // 제목 폴백(필수) — 빈 제목으로 빌드 깨지지 않게
    if (!base.title || !String(base.title).trim()) {
      base.title = base.video_title || base.image_label || `항목 ${r.item_key ?? idx}`;
      warn(`items[${idx}] (${r.item_key}): 빈 제목 → 폴백 "${base.title}"`);
    }

    // 영상: URL → video_id. 없으면 건너뜀(빌드 유지)
    if (base.type === "video") {
      const vid = extractVideoId((base.video_url as string) ?? (base.video_id as string));
      if (!vid) { warn(`items[${idx}] (${r.item_key}): 영상 URL 없음 → 건너뜀`); return null; }
      base.video_id = vid;
      if (isFlow && !base.description && base.video_title) base.description = base.video_title;
    }

    // 본문: 마크다운 → HTML → 새니타이즈. body 없으면 건너뜀
    if (base.type === "text") {
      if (!base.body) { warn(`items[${idx}] (${r.item_key}): text body 없음 → 건너뜀`); return null; }
      const html = markdownToHtml(String(base.body));
      try { base.body = assertSafeHtml(html, `items[${idx}] ${r.item_key}`); }
      catch (e) { warn(`items[${idx}] (${r.item_key}): 본문 새니타이즈 실패 → 건너뜀 (${(e as Error).message})`); return null; }
    }

    // intro 결손 폴백
    if (base.type === "intro") {
      if (!base.core_idea) base.core_idea = "이 단원의 핵심 내용을 살펴봅니다.";
      if (!base.core_question) base.core_question = "이 단원에서 무엇을 배울까?";
    }
    // image 라벨 폴백
    if (base.type === "image" && !base.image_url && !base.image_label) {
      base.image_label = base.title;
    }

    const res = ItemSchema.safeParse(base);
    if (!res.success) { warn(`items[${idx}] (${r.item_key}) 건너뜀: ${res.error.issues.map((i) => i.path.join(".") + " " + i.message).join("; ")}`); return null; }
    const item = res.data;

    // 무결성: 깨진 행은 건너뜀(빌드 유지)
    if (!flowById.has(item.kit_id)) { warn(`items[${idx}]: 존재하지 않는 kit_id "${item.kit_id}" → 건너뜀`); return null; }
    // 활동형만 고정 단계 검증. 흐름형은 stage가 핵심 용어(자유 문자열)이므로 검증 생략(단원안내 intro 포함).
    if (!isFlow && !ACTIVITY_STAGES.includes(item.stage)) { warn(`items[${idx}] (${item.item_key}): "${item.stage}"는 활동형 stage 아님 → 건너뜀`); return null; }
    if (seen.has(key0)) { warn(`중복 item_key ${key0} → 건너뜀`); return null; }
    seen.add(key0);

    return { id: `${item.kit_id}_${item.item_key}`, ...item } as Item;
  });

  return items.filter((x): x is Item => x !== null);
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
    if (!res.success) { warn(`stage_meta[${idx}] 건너뜀: ${res.error.issues.map((i) => i.path.join(".") + " " + i.message).join("; ")}`); return null; }
    if (!ids.has(res.data.kit_id)) { warn(`stage_meta[${idx}]: 존재하지 않는 kit_id "${res.data.kit_id}" → 건너뜀`); return null; }
    return res.data as StageMeta;
  }).filter((x): x is StageMeta => x !== null);
}

function main() {
  const kits = buildKits(); // 중복 id는 buildKits에서 첫 항목만 유지
  const items = buildItems(kits);
  const stageMeta = buildStageMeta(kits);

  // 각 꾸러미의 내장 콘텐츠 수(intro 제외) → kits.json에 부가(홈 카드가 items.json 없이 표시).
  const contentCount = new Map<string, number>();
  for (const it of items) {
    if (it.type === "intro") continue;
    contentCount.set(it.kit_id, (contentCount.get(it.kit_id) ?? 0) + 1);
  }
  for (const k of kits) k.content_count = contentCount.get(k.id) ?? 0;

  kits.sort((a, b) => a.grade - b.grade || a.sort_order - b.sort_order);
  items.sort((a, b) => a.kit_id.localeCompare(b.kit_id) || a.sort_order - b.sort_order);

  mkdirSync(OUT, { recursive: true });
  writeFileSync(resolve(OUT, "kits.json"), JSON.stringify(kits, null, 2) + "\n");
  writeFileSync(resolve(OUT, "items.json"), JSON.stringify(items, null, 2) + "\n");
  writeFileSync(resolve(OUT, "stage_meta.json"), JSON.stringify(stageMeta, null, 2) + "\n");

  console.log(`✓ kits: ${kits.length} (공개 ${kits.filter((k) => k.published).length})`);
  console.log(`✓ items: ${items.length}`);
  console.log(`✓ stage_meta: ${stageMeta.length}`);
  if (_warnCount) console.log(`⚠ 경고 ${_warnCount}건(자동 보정/건너뜀) — 위 로그 확인. 빌드는 계속 진행됨.`);
  console.log(`→ data/kits.json · items.json · stage_meta.json`);
}

main();
