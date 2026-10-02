// 시트 행 모양 → 사이트 데이터(data/*.json) 변환·검증·새니타이즈.
// 시트 시절 sheet-to-json.ts의 변환 규칙을 그대로 옮겼다. 달라진 점: 행을 파일에서 읽지 않고 인자로 받으며,
// 경고를 모아 돌려준다(build-data.ts는 경고가 하나라도 있으면 실패 — 조용히 건너뛰고 배포하지 않는다).

import { z } from "zod";
import { normalizeRow, normalizeStage, splitConcepts, toBool, toInt, extractVideoId } from "./field-map.ts";
import { markdownToHtml } from "./markdown.ts";
import { assertSafeHtml } from "./sanitize.ts";
import type { Kit, Item, StageMeta, QuizItem } from "./types.ts";

const ACTIVITY_STAGES = ["단원안내", "생각열기", "탐구하기", "탐구하기1", "탐구하기2", "확장하기"];

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
  concept_desc: z.string().optional(),
  standard_code: z.string().optional(),
  standard_text: z.string().optional(),
  video_url: z.string().optional(),
  video_id: z.string().regex(/^[A-Za-z0-9_-]{11}$/).optional(),
  video_title: z.string().optional(),
  video_desc: z.string().optional(),
  start_sec: z.number().int().nonnegative().optional(),
  end_sec: z.number().int().nonnegative().optional(),
  video_license: z.string().optional(),
  channel: z.string().optional(),
  video_embed: z.literal(false).optional(),
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

const QuizSchema = z.object({
  kit_id: z.string().min(1),
  statement: z.string().min(1),
  answer: z.enum(["O", "X"]),
  explain: z.string().optional(),
  sort_order: z.number().int(),
});

type Row = Record<string, unknown>;
export interface SheetRows { kits: Row[]; items: Row[]; stage_meta: Row[]; quiz: Row[] }
export interface DataOut { kits: Kit[]; items: Item[]; stageMeta: StageMeta[]; quiz: QuizItem[]; warnings: string[] }

// 성취기준: code/text를 ';'로 분리해 순서대로 짝지음(복수 성취기준 지원). 짝이 안 맞으면 있는 쪽만.
function parseStandards(code: unknown, text: unknown): { code: string; text: string }[] {
  const codes = String(code ?? "").split(";").map((s) => s.trim());
  const texts = String(text ?? "").split(";").map((s) => s.trim());
  const n = Math.max(codes.length, texts.length);
  const out: { code: string; text: string }[] = [];
  for (let i = 0; i < n; i++) {
    const c = codes[i] ?? "", t = texts[i] ?? "";
    if (c || t) out.push({ code: c, text: t });
  }
  return out;
}

// 핵심 용어 설명: concepts[i]와 concept_desc[i](';' 구분)를 순서로 짝지음. 정의 없는 용어는 제외.
function parseConceptDefs(concepts: unknown, desc: unknown): { term: string; def: string }[] {
  const terms = Array.isArray(concepts) ? concepts.map((c) => String(c).trim()) : [];
  if (!terms.length) return [];
  const defs = String(desc ?? "").split(";").map((s) => s.trim());
  const out: { term: string; def: string }[] = [];
  for (let i = 0; i < terms.length; i++) {
    const term = terms[i] ?? "", def = defs[i] ?? "";
    if (term && def) out.push({ term, def });
  }
  return out;
}

export function transform(sheet: SheetRows): DataOut {
  const warnings: string[] = [];
  const warn = (msg: string) => { warnings.push(msg); };
  const rowsOf = (arr: Row[]) => arr.map((r) => normalizeRow(r));

  // ── kits
  const used = new Set<string>();
  const kits: Kit[] = [];
  rowsOf(sheet.kits).forEach((r, idx) => {
    const parsed = { ...r, grade: toInt(r.grade), unit_no: toInt(r.unit_no), sort_order: toInt(r.sort_order), published: toBool(r.published) };
    const res = KitSchema.safeParse(parsed);
    if (!res.success) { warn(`kits[${idx}] (${r.id}) 건너뜀: ${res.error.issues.map((i) => i.path.join(".") + " " + i.message).join("; ")}`); return; }
    const kit = res.data as Kit;
    if (used.has(kit.id)) { warn(`kits[${idx}] 중복 id "${kit.id}" → 건너뜀(첫 항목 유지)`); return; }
    used.add(kit.id);
    kits.push(kit);
  });

  // ── items
  const flowById = new Map(kits.map((k) => [k.id, k.flow]));
  const seen = new Set<string>();
  const items = rowsOf(sheet.items).map((r, idx) => {
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

    if (!base.title || !String(base.title).trim()) {
      base.title = base.video_title || base.image_label || `항목 ${r.item_key ?? idx}`;
      warn(`items[${idx}] (${r.item_key}): 빈 제목 → 폴백 "${base.title}"`);
    }

    if (base.type === "video") {
      const vid = extractVideoId((base.video_url as string) ?? (base.video_id as string));
      if (!vid) { warn(`items[${idx}] (${key0}): 영상 URL 없음 → 건너뜀`); return null; }
      base.video_id = vid;
      if (isFlow && !base.description && base.video_title) base.description = base.video_title;
      // 임베드 차단 영상만 video_embed=false 키를 남긴다(뷰어는 !== false 를 정상으로 본다).
      delete base.video_embed;
      const embedCell = r.video_embed;
      const embedFilled = embedCell !== undefined && embedCell !== null && String(embedCell).trim() !== "";
      if (embedFilled && !toBool(embedCell)) base.video_embed = false;
    }

    if (base.type === "text") {
      if (!base.body) { warn(`items[${idx}] (${key0}): text body 없음 → 건너뜀`); return null; }
      const html = markdownToHtml(String(base.body));
      try { base.body = assertSafeHtml(html, `items[${idx}] ${r.item_key}`); }
      catch (e) { warn(`items[${idx}] (${key0}): 본문 새니타이즈 실패 → 건너뜀 (${(e as Error).message})`); return null; }
    }

    if (base.type === "intro") {
      base.stage = "단원안내";
      if (!base.core_idea) base.core_idea = "이 단원의 핵심 내용을 살펴봅니다.";
      if (!base.core_question) base.core_question = "이 단원에서 무엇을 배울까?";
    }
    if (base.type === "image" && !base.image_url && !base.image_label) base.image_label = base.title;

    const res = ItemSchema.safeParse(base);
    if (!res.success) { warn(`items[${idx}] (${key0}) 건너뜀: ${res.error.issues.map((i) => i.path.join(".") + " " + i.message).join("; ")}`); return null; }
    const item = res.data;

    if (!flowById.has(item.kit_id)) { warn(`items[${idx}]: 존재하지 않는 kit_id "${item.kit_id}" → 건너뜀`); return null; }
    if (!isFlow && !ACTIVITY_STAGES.includes(item.stage)) { warn(`items[${idx}] (${key0}): "${item.stage}"는 활동형 stage 아님 → 건너뜀`); return null; }
    if (seen.has(key0)) { warn(`중복 item_key ${key0} → 건너뜀`); return null; }
    seen.add(key0);

    const standards = parseStandards(item.standard_code, item.standard_text);
    const conceptDefs = item.type === "intro" ? parseConceptDefs(item.concepts, item.concept_desc) : [];
    return {
      id: `${item.kit_id}_${item.item_key}`,
      ...item,
      ...(standards.length ? { standards } : {}),
      ...(conceptDefs.length ? { concept_defs: conceptDefs } : {}),
    } as Item;
  }).filter((x): x is Item => x !== null);

  // ── stage_meta
  const ids = new Set(kits.map((k) => k.id));
  const stageMeta = rowsOf(sheet.stage_meta).map((r, idx) => {
    const q = typeof r.question === "string" ? r.question.trim() : r.question;
    const parsed = { kit_id: r.kit_id, stage: normalizeStage(String(r.stage ?? "")), question: q ? String(q) : null, sort_order: toInt(r.sort_order) };
    const res = StageMetaSchema.safeParse(parsed);
    if (!res.success) { warn(`stage_meta[${idx}] 건너뜀: ${res.error.issues.map((i) => i.path.join(".") + " " + i.message).join("; ")}`); return null; }
    if (!ids.has(res.data.kit_id)) { warn(`stage_meta[${idx}]: 존재하지 않는 kit_id "${res.data.kit_id}" → 건너뜀`); return null; }
    return res.data as StageMeta;
  }).filter((x): x is StageMeta => x !== null);

  // ── quiz
  const quiz = rowsOf(sheet.quiz).map((r, idx) => {
    const parsed = { kit_id: r.kit_id, statement: r.statement, answer: String(r.answer ?? "").trim().toUpperCase(), explain: r.explain, sort_order: toInt(r.sort_order) ?? idx };
    const res = QuizSchema.safeParse(parsed);
    if (!res.success) { warn(`quiz[${idx}] 건너뜀: ${res.error.issues.map((i) => i.path.join(".") + " " + i.message).join("; ")}`); return null; }
    if (!ids.has(res.data.kit_id)) { warn(`quiz[${idx}]: 존재하지 않는 kit_id "${res.data.kit_id}" → 건너뜀`); return null; }
    return res.data as QuizItem;
  }).filter((x): x is QuizItem => x !== null);

  // 공개 단원의 퀴즈가 1문제뿐이면 퀴즈 화면이 안 나온다 — 미완성 단원 가시화.
  const countByKit = new Map<string, number>();
  for (const q of quiz) countByKit.set(q.kit_id, (countByKit.get(q.kit_id) ?? 0) + 1);
  for (const k of kits) {
    if (k.published && (countByKit.get(k.id) ?? 0) === 1) warn(`quiz: 꾸러미 "${k.id}" 문제 1개뿐 → 퀴즈 화면 미노출(최소 2개 필요)`);
  }

  // 각 꾸러미의 내장 콘텐츠 수(intro 제외) → 홈 카드가 items.json 없이 표시.
  const contentCount = new Map<string, number>();
  for (const it of items) {
    if (it.type === "intro") continue;
    contentCount.set(it.kit_id, (contentCount.get(it.kit_id) ?? 0) + 1);
  }
  for (const k of kits) k.content_count = contentCount.get(k.id) ?? 0;

  kits.sort((a, b) => a.grade - b.grade || a.sort_order - b.sort_order);
  items.sort((a, b) => a.kit_id.localeCompare(b.kit_id) || a.sort_order - b.sort_order);
  quiz.sort((a, b) => a.kit_id.localeCompare(b.kit_id) || a.sort_order - b.sort_order);

  return { kits, items, stageMeta, quiz, warnings };
}
