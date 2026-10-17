// 후보 기록 → 꾸러미 YAML — npm run import -- <id> [<id> …] [--dry]
// content/_candidates/<id>.yaml(양식: docs/EXPANSION_PLAN_moral-practical.md §5-1)을 검사하고,
// verdict가 "채택"인 후보만 content/kits/<id>.yaml의 items로 옮긴다. 후보 파일은 고치지 않는다.
//   --dry   검사만(파일을 쓰지 않음). id를 안 주면 _candidates 전체를 대상으로 한다.
// build-data·check는 content/kits/만 읽으므로 _candidates는 빌드에 섞이지 않는다.

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import YAML from "yaml";
import { z } from "zod";
import { ROOT, KITS_DIR, KitDocSchema, kitToYaml, type KitDoc, type VideoItem } from "./content.ts";
import { extractVideoId } from "./field-map.ts";

const CAND_DIR = resolve(ROOT, "content/_candidates");
const USES = ["수업 전", "수업 중", "수업 후", "배경지식"] as const;
const VERDICTS = ["추천", "보류", "제외", "확인필요", "채택"] as const;
const GRADES = ["public", "edu", "press", "personal"] as const;

const nonEmpty = z.string().min(1);

const CandKitSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9]{3,8}$/, "id는 3~8자 영숫자"),
  title: nonEmpty,
  grade: z.union([z.literal(3), z.literal(4), z.literal(5), z.literal(6)]),
  sem: z.enum(["1학기", "2학기"]),
  subject: z.enum(["사회", "과학", "도덕", "실과"]),
  unit: nonEmpty,
  unit_no: z.number().int().positive(),
  flow: z.enum(["activity", "flow"]),
  sort_order: z.number().int().optional(), // 없으면 1(소단원 자리, 과학처럼 고정)
  published: z.boolean().optional(),       // 없으면 true
  codes: z.array(nonEmpty).min(1),         // 원문은 content/_ref/standards-2022.json에서 가져온다
  core_idea: nonEmpty,
  core_question: nonEmpty,
  stages: z.array(z.union([
    nonEmpty,
    z.object({ name: nonEmpty, question: nonEmpty.optional() }).strict(),
  ])).min(1),
  concepts: z.array(nonEmpty).default([]),
  source_notes: z.string().optional(),     // 근거 메모 — 꾸러미 YAML에 안 들어간다
}).strict();

const CandSchema = z.object({
  cand_no: nonEmpty,
  key: z.string().regex(/^[A-Za-z0-9_]+$/).optional(), // 기존 꾸러미를 고칠 때만 — 그 key의 영상을 갱신
  stage: nonEmpty,
  title: nonEmpty,
  video_title: nonEmpty.optional(),
  url: nonEmpty,
  channel: z.string().optional(),
  channel_grade: z.enum(GRADES).optional(),
  local: z.string().optional(),
  duration: z.union([z.string(), z.number()]).optional(),
  start: z.number().int().nonnegative().optional(),
  end: z.number().int().nonnegative().optional(),
  use: z.enum(USES).optional(),
  basis_code: z.string().optional(),
  basis_lesson: z.string().optional(),
  desc: z.string().optional(),
  verdict: z.enum(VERDICTS),
  reviewer: z.string().optional(),
  note: z.string().optional(),
}).strict();

const CandFileSchema = z.object({
  kit: CandKitSchema,
  candidates: z.array(CandSchema).default([]),
}).strict();

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const onlyIds = args.filter((a) => !a.startsWith("-"));

const refPath = resolve(ROOT, "content/_ref/standards-2022.json");
const ref = JSON.parse(readFileSync(refPath, "utf8")) as { standards: { code: string; subject: string; gradeBand: string; text: string }[] };
const refByCode = new Map(ref.standards.map((s) => [s.code, s]));

if (!existsSync(CAND_DIR)) { console.error("content/_candidates/ 가 없습니다."); process.exit(1); }
const files = readdirSync(CAND_DIR)
  .filter((f) => f.endsWith(".yaml") && (!onlyIds.length || onlyIds.includes(f.replace(/\.yaml$/, ""))))
  .sort();
if (!files.length) { console.error("대상 후보 파일이 없습니다."); process.exit(1); }

let totalErrors = 0;

for (const f of files) {
  const id = f.replace(/\.yaml$/, "");
  const errors: string[] = [];
  const warns: string[] = [];
  const out = (s: string) => console.log(s);

  let data: unknown;
  try { data = YAML.parse(readFileSync(resolve(CAND_DIR, f), "utf8")); }
  catch (e) { console.error(`✗ ${f}: YAML 문법 오류 — ${(e as Error).message}`); totalErrors++; continue; }
  const res = CandFileSchema.safeParse(data);
  if (!res.success) {
    console.error(`✗ ${f}: 양식 오류\n` + res.error.issues.map((i) => `    ${i.path.join(".")}: ${i.message}`).join("\n"));
    totalErrors++; continue;
  }
  const { kit, candidates } = res.data;
  if (kit.id !== id) errors.push(`파일 이름과 kit.id(${kit.id})가 다름`);

  // 단계·성취기준 점검
  const stageNames = kit.stages.map((s) => (typeof s === "string" ? s : s.name));
  if (new Set(stageNames).size !== stageNames.length) errors.push("단계 이름 중복");
  const standards: { code: string; text: string }[] = [];
  const band = kit.grade <= 4 ? "3-4" : "5-6";
  for (const code of kit.codes) {
    const r = refByCode.get(code);
    if (!r) { errors.push(`성취기준 ${code}가 기준표에 없음`); continue; }
    if (r.subject !== kit.subject) errors.push(`성취기준 ${code}는 ${r.subject} — 꾸러미는 ${kit.subject}`);
    if (r.gradeBand !== band) errors.push(`성취기준 ${code}는 ${r.gradeBand}학년군 — 꾸러미는 ${kit.grade}학년`);
    standards.push({ code, text: r.text });
  }

  // 후보 점검
  const candNos = new Set<string>();
  const urls = new Map<string, string>(); // video id → cand_no(채택된 것 중 첫째)
  const adopted: z.infer<typeof CandSchema>[] = [];
  for (const c of candidates) {
    const tag = c.cand_no;
    if (candNos.has(tag)) errors.push(`${tag}: cand_no 중복`);
    candNos.add(tag);
    if (!stageNames.includes(c.stage)) errors.push(`${tag}: 단계 "${c.stage}"가 kit.stages에 없음`);
    const vid = extractVideoId(c.url);
    if (!vid || /[\s\u0000-\u001f]/.test(c.url)) errors.push(`${tag}: 영상 주소에서 영상 ID를 못 뽑음 — ${c.url}`);
    if (c.url.includes("list=") && !c.url.includes("v=")) errors.push(`${tag}: 재생 목록 주소 — 개별 영상 주소로`);
    if (c.start !== undefined && c.end !== undefined && c.end > 0 && c.end <= c.start) errors.push(`${tag}: 구간 끝 ≤ 시작`);
    if (c.verdict !== "채택") continue;
    // 채택 후보 전용 점검
    if (!c.reviewer) errors.push(`${tag}: 채택인데 reviewer 없음 — 채택은 운영자 판정 뒤에만`);
    if (!c.desc) errors.push(`${tag}: 채택인데 desc 없음`);
    if (!c.use) warns.push(`${tag}: 쓰임(use) 비어 있음`);
    if (c.channel_grade === "personal" && !c.note) errors.push(`${tag}: personal 채널인데 note(사유) 없음`);
    if (vid) {
      const dup = urls.get(vid);
      if (dup) { warns.push(`${tag}: ${dup}와 같은 영상 — 건너뜀`); continue; }
      urls.set(vid, tag);
    }
    adopted.push(c);
  }
  const counts = Object.fromEntries(VERDICTS.map((v) => [v, candidates.filter((c) => c.verdict === v).length]));

  // 기존 꾸러미(있으면 고치고, 없으면 만든다)
  const outPath = resolve(KITS_DIR, `${id}.yaml`);
  let doc: KitDoc | undefined;
  if (existsSync(outPath)) {
    const old = KitDocSchema.safeParse(YAML.parse(readFileSync(outPath, "utf8")));
    if (!old.success) errors.push(`기존 content/kits/${id}.yaml이 양식에 안 맞음`);
    else doc = old.data;
  }

  if (!errors.length) {
    const items: VideoItem[] = doc ? [...doc.items] : [];
    const usedKeys = new Set(items.map((i) => i.key));
    let n = 0;
    for (const it of items) { const m = /^v(\d+)$/.exec(it.key); if (m) n = Math.max(n, Number(m[1])); }
    let added = 0, updated = 0;
    // 새 key는 화면 순서(단계 순서 → 들어온 순서)대로 매긴다
    const stageIdx = (st: string) => stageNames.indexOf(st);
    adopted.sort((x, y) => stageIdx(x.stage) - stageIdx(y.stage));
    for (const c of adopted) {
      const body = {
        stage: c.stage, title: c.title, use: c.use, url: c.url, desc: c.desc, // video_title은 옮기지 않는다(check가 목차 제목 ≠ 영상 제목을 경고). 후보 파일에는 기록으로 남음
        start: c.start && c.start > 0 ? c.start : undefined,
        end: c.end && c.end > 0 ? c.end : undefined,
      };
      const idx = c.key ? items.findIndex((i) => i.key === c.key) : -1;
      if (c.key && idx < 0) { errors.push(`${c.cand_no}: key ${c.key}가 기존 꾸러미에 없음`); continue; }
      if (idx >= 0) {
        const prev = items[idx]!;
        const same = extractVideoId(prev.url) === extractVideoId(c.url);
        // 같은 영상이면 점검 결과(channel·status)·embed를 지키고, 영상이 바뀌면 지운다(다음 점검이 다시 채움)
        items[idx] = { key: prev.key, ...body, ...(same ? { embed: prev.embed, channel: prev.channel, status: prev.status } : {}) } as VideoItem;
        updated++;
      } else {
        // 이미 같은 영상이 꾸러미에 있으면 건너뜀
        if (items.some((i) => extractVideoId(i.url) === extractVideoId(c.url))) { warns.push(`${c.cand_no}: 이미 꾸러미에 있는 영상 — 건너뜀`); continue; }
        let key: string;
        do { key = `v${++n}`; } while (usedKeys.has(key));
        usedKeys.add(key);
        items.push({ key, ...body } as VideoItem);
        added++;
      }
    }
    // 화면 순서: 단계 순서대로 묶되, 단계 안에서는 들어온 순서를 지킨다
    const order = new Map(stageNames.map((s, i) => [s, i]));
    const sorted = items.map((it, i) => ({ it, i })).sort((a, b) => (order.get(a.it.stage) ?? 99) - (order.get(b.it.stage) ?? 99) || a.i - b.i).map((x) => x.it);

    const next: KitDoc = doc
      ? { ...doc, stages: kit.stages as KitDoc["stages"], items: sorted }
      : {
          id: kit.id, title: kit.title, grade: kit.grade, sem: kit.sem, subject: kit.subject,
          unit: kit.unit, unit_no: kit.unit_no, flow: kit.flow, sort_order: kit.sort_order ?? 1, published: kit.published ?? true,
          intro: {
            core_idea: kit.core_idea, core_question: kit.core_question,
            concepts: kit.concepts.map((term) => ({ term })), // 풀이(def)는 ⑤에서 Claude 초안 → 운영자 검수
            standards,
          },
          stages: kit.stages as KitDoc["stages"],
          items: sorted,
          quiz: [],
        };
    const check = KitDocSchema.safeParse(next);
    if (!check.success) errors.push("꾸러미 양식 오류: " + check.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    else if (!errors.length) {
      out(`${errors.length ? "✗" : "✓"} ${id} — 후보 ${candidates.length}(추천 ${counts["추천"]} · 확인필요 ${counts["확인필요"]} · 보류 ${counts["보류"]} · 제외 ${counts["제외"]} · 채택 ${counts["채택"]}) → 영상 +${added}${updated ? ` ~${updated}` : ""}, 합계 ${sorted.length}편${doc ? " (기존 꾸러미 갱신)" : " (새 꾸러미)"}`);
      if (!dry) {
        writeFileSync(outPath, kitToYaml(check.data), "utf8");
        out(`  → content/kits/${id}.yaml 씀`);
      } else out("  (--dry: 파일을 쓰지 않음)");
    }
  }
  for (const w of warns) out(`  ⚠ ${w}`);
  for (const e of errors) console.error(`  ✗ ${id}: ${e}`);
  if (errors.length) totalErrors++;
}

if (totalErrors) { console.error(`\n오류 ${totalErrors}건 — 고친 뒤 다시 실행하세요.`); process.exit(1); }
