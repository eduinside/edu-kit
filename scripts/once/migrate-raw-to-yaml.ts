// 1회용(2026-10-02): 시트 발행본 data/raw/*.json → content/kits/<id>.yaml
// 이 커밋 뒤 data/raw는 지워지므로 다시 돌릴 일은 없다. 변환 규칙의 기록으로 남겨 둔다.
//
// 순서 규칙 — 화면에 보이는 순서를 그대로 목록 순서로 옮긴다:
//   단계(stages) = stage_meta를 sort_order로 정렬(동순위는 시트 행 순서)
//   영상(items)  = 시트 행을 sort_order로 정렬(동순위는 시트 행 순서)한 뒤, 단계 순서대로 묶는다
//                  (뷰어는 단계별로 묶어 sort_order로 정렬하므로 단계 안 순서가 그대로 유지된다)
//   퀴즈(quiz)   = sort_order로 정렬
// sort_order 숫자는 버리고, 새 빌드가 목록 순서로 다시 매긴다.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { normalizeRow, normalizeStage, toBool, toInt } from "../field-map.ts";
import { ROOT, KITS_DIR, KitDocSchema, kitToYaml, type KitDoc } from "../content.ts";

type Row = Record<string, unknown>;
const raw = (name: string): Row[] =>
  (JSON.parse(readFileSync(resolve(ROOT, "data/raw", name), "utf8")) as Row[]).map((r) => normalizeRow(r));

const kits = raw("kits.json");
const items = raw("items.json");
const stageMeta = raw("stage_meta.json");
const quiz = raw("quiz.json");

const S = (v: unknown) => (v === undefined || v === null ? undefined : String(v));
const bySort = (rows: Row[]) =>
  rows.map((r, i) => ({ r, i })).sort((a, b) => (toInt(a.r.sort_order) ?? 0) - (toInt(b.r.sort_order) ?? 0) || a.i - b.i).map((x) => x.r);
const splitSemi = (v: unknown) => (v === undefined ? [] : String(v).split(";").map((s) => s.trim()));

mkdirSync(KITS_DIR, { recursive: true });
let n = 0;
for (const k of kits) {
  const id = String(k.id);
  const intro = items.find((i) => i.kit_id === id && i.type === "intro");
  if (!intro) throw new Error(`${id}: intro 없음`);

  const terms = splitSemi(intro.concepts).filter(Boolean);
  const defs = intro.concept_desc === undefined ? [] : splitSemi(intro.concept_desc);
  const codes = splitSemi(intro.standard_code);
  const texts = splitSemi(intro.standard_text);

  const stages = bySort(stageMeta.filter((s) => s.kit_id === id)).map((s) => {
    const name = normalizeStage(String(s.stage));
    const q = S(s.question)?.trim();
    return q ? { name, question: q } : name;
  });
  const stageNames = stages.map((s) => (typeof s === "string" ? s : s.name));

  const videos = bySort(items.filter((i) => i.kit_id === id && i.type === "video"));
  const ordered = [
    ...stageNames.flatMap((st) => videos.filter((v) => normalizeStage(String(v.stage)) === st)),
    ...videos.filter((v) => !stageNames.includes(normalizeStage(String(v.stage)))),
  ];

  const doc: KitDoc = {
    id,
    title: String(k.title),
    grade: toInt(k.grade) as KitDoc["grade"],
    sem: String(k.sem) as KitDoc["sem"],
    subject: String(k.subject) as KitDoc["subject"],
    unit: String(k.unit),
    unit_no: toInt(k.unit_no)!,
    flow: String(k.flow) as KitDoc["flow"],
    sort_order: toInt(k.sort_order)!,
    published: toBool(k.published),
    intro: {
      core_idea: String(intro.core_idea),
      core_question: String(intro.core_question),
      concepts: terms.map((term, i) => (defs[i] ? { term, def: defs[i] } : { term })),
      standards: codes.map((code, i) => ({ code, text: texts[i] ?? "" })),
    },
    stages,
    items: ordered.map((v) => {
      const title = String(v.title);
      const vt = S(v.video_title);
      return {
        key: String(v.item_key),
        stage: normalizeStage(String(v.stage)),
        title,
        use: S(v.description),
        url: String(v.video_url),
        video_title: vt && vt !== title ? vt : undefined,
        desc: S(v.video_desc),
        start: toInt(v.start_sec),
        end: toInt(v.end_sec),
        embed: v.video_embed !== undefined && !toBool(v.video_embed) ? (false as const) : undefined,
      };
    }),
    quiz: bySort(quiz.filter((q) => q.kit_id === id)).map((q) => ({
      statement: String(q.statement),
      answer: String(q.answer).trim().toUpperCase() as "O" | "X",
      explain: S(q.explain),
    })),
  };

  const res = KitDocSchema.safeParse(JSON.parse(JSON.stringify(doc)));
  if (!res.success) throw new Error(`${id}: ${res.error.issues.map((i) => i.path.join(".") + " " + i.message).join("; ")}`);
  writeFileSync(resolve(KITS_DIR, `${id}.yaml`), kitToYaml(res.data));
  n++;
}
console.log(`✓ ${n}개 꾸러미 → content/kits/*.yaml`);
