// 콘텐츠 정본 — content/kits/<id>.yaml (꾸러미 하나 = 파일 하나). 형식: docs/OPERATIONS.md §2
// 이 모듈: YAML 스키마(zod) · 읽기(→ 시트 행 모양) · 쓰기(직렬화).
// 시트 행 모양으로 바꿔 넘기는 이유: 변환·검증 로직(transform.ts)을 시트 시절 그대로 재사용하기 위해서.

import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import YAML from "yaml";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const KITS_DIR = resolve(ROOT, "content/kits");

const ConceptSchema = z.object({
  term: z.string().min(1),
  def: z.string().min(1).optional(), // 없으면 그 용어는 화면에서 눌리지 않는다
}).strict();

const StandardSchema = z.object({
  code: z.string().min(1),
  text: z.string().min(1),
}).strict();

// 단계: 질문이 없으면 이름만, 있으면 { name, question }
const StageSchema = z.union([
  z.string().min(1),
  z.object({ name: z.string().min(1), question: z.string().min(1).optional() }).strict(),
]);

export const VideoItemSchema = z.object({
  key: z.string().regex(/^[A-Za-z0-9_]+$/, "key는 영숫자/밑줄"),
  stage: z.string().min(1),
  title: z.string().min(1),
  use: z.string().min(1).optional(), // 쓰임: 수업 전 · 수업 중 · 수업 후 · 배경지식 (흐름형)
  url: z.string().min(1),
  video_title: z.string().min(1).optional(), // 없으면 title과 같다
  desc: z.string().min(1).optional(),
  start: z.number().int().nonnegative().optional(),
  end: z.number().int().nonnegative().optional(),
  embed: z.literal(false).optional(), // 임베드 차단 영상만 false
  // ↓ 사람이 쓰지 않는 칸 — npm run videos가 채운다(상태는 문제 있을 때만 남는다)
  channel: z.string().min(1).optional(),
  status: z.enum(["삭제·비공개", "비공개", "연령제한", "국내차단", "임베드차단", "URL오류"]).optional(),
}).strict();

const QuizSchema = z.object({
  statement: z.string().min(1),
  answer: z.enum(["O", "X"]),
  explain: z.string().min(1).optional(),
}).strict();

export const KitDocSchema = z.object({
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
  intro: z.object({
    core_idea: z.string().min(1),
    core_question: z.string().min(1),
    concepts: z.array(ConceptSchema).default([]),
    standards: z.array(StandardSchema).min(1),
  }).strict(),
  stages: z.array(StageSchema).min(1),
  items: z.array(VideoItemSchema),
  quiz: z.array(QuizSchema).default([]),
}).strict();

export type KitDoc = z.infer<typeof KitDocSchema>;
export type VideoItem = z.infer<typeof VideoItemSchema>;
type Row = Record<string, unknown>;

export const INTRO_DESCRIPTION = "이 단원에서 무엇을 배울까요";

export const stageName = (s: KitDoc["stages"][number]) => (typeof s === "string" ? s : s.name);
export const stageQuestion = (s: KitDoc["stages"][number]) => (typeof s === "string" ? undefined : s.question);

export interface LoadedKit { file: string; doc: KitDoc }
export interface LoadError { file: string; message: string }

/** content/kits/*.yaml 전부 읽기(파일 이름순). 스키마 오류는 모아서 돌려준다. */
export function loadKitDocs(dir = KITS_DIR): { kits: LoadedKit[]; errors: LoadError[] } {
  const files = readdirSync(dir).filter((f) => f.endsWith(".yaml")).sort();
  const kits: LoadedKit[] = [];
  const errors: LoadError[] = [];
  for (const f of files) {
    const path = resolve(dir, f);
    let data: unknown;
    try {
      data = YAML.parse(readFileSync(path, "utf8"));
    } catch (e) {
      errors.push({ file: f, message: `YAML 문법 오류: ${(e as Error).message}` });
      continue;
    }
    const res = KitDocSchema.safeParse(data);
    if (!res.success) {
      errors.push({ file: f, message: res.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") });
      continue;
    }
    if (`${res.data.id}.yaml` !== basename(f)) {
      errors.push({ file: f, message: `파일 이름과 id(${res.data.id})가 다름` });
      continue;
    }
    kits.push({ file: f, doc: res.data });
  }
  return { kits, errors };
}

/** 꾸러미 문서 → 시트 시절의 행 모양(kits·items·stage_meta·quiz). 순서 = 목록 순서, sort_order는 여기서 매긴다. */
export function toSheetRows(docs: KitDoc[]): { kits: Row[]; items: Row[]; stage_meta: Row[]; quiz: Row[] } {
  const kits: Row[] = [], items: Row[] = [], stage_meta: Row[] = [], quiz: Row[] = [];
  for (const d of docs) {
    kits.push({
      id: d.id, title: d.title, grade: d.grade, sem: d.sem, subject: d.subject,
      unit: d.unit, unit_no: d.unit_no, flow: d.flow, sort_order: d.sort_order, published: d.published,
    });

    const terms = d.intro.concepts.map((c) => c.term);
    const anyDef = d.intro.concepts.some((c) => c.def);
    items.push({
      kit_id: d.id, item_key: "intro", stage: "단원안내", type: "intro",
      title: d.title, description: INTRO_DESCRIPTION, sort_order: 1,
      core_idea: d.intro.core_idea, core_question: d.intro.core_question,
      concepts: terms.length ? terms.join(" ; ") : undefined,
      concept_desc: anyDef ? d.intro.concepts.map((c) => c.def ?? "").join(" ; ") : undefined,
      standard_code: d.intro.standards.map((s) => s.code).join(" ; "),
      standard_text: d.intro.standards.map((s) => s.text).join(" ; "),
    });

    d.items.forEach((it, i) => {
      items.push({
        kit_id: d.id, item_key: it.key, stage: it.stage, type: "video",
        title: it.title, description: it.use, sort_order: i + 2, // intro가 1
        video_url: it.url, video_title: it.video_title ?? it.title, video_desc: it.desc,
        start_sec: it.start, end_sec: it.end,
        video_embed: it.embed === false ? false : undefined,
      });
    });

    d.stages.forEach((s, i) => {
      stage_meta.push({ kit_id: d.id, stage: stageName(s), question: stageQuestion(s), sort_order: i + 1 });
    });

    d.quiz.forEach((q, i) => {
      quiz.push({ kit_id: d.id, statement: q.statement, answer: q.answer, explain: q.explain, sort_order: i + 1 });
    });
  }
  return { kits, items, stage_meta, quiz };
}

/** 꾸러미 문서 → YAML 문자열(키 순서 고정, 줄 접기 없음 — 변경 내역을 읽기 쉽게). */
export function kitToYaml(doc: KitDoc): string {
  const clean = JSON.parse(JSON.stringify(doc)); // undefined 키 제거
  return new YAML.Document(clean).toString({ lineWidth: 0, minContentWidth: 0 });
}
