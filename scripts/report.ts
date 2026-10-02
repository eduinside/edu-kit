// 변경 보고서 — npm run report [기준=origin/main]
// 작업 중인 content/kits/*.yaml을 기준 커밋과 꾸러미별로 비교한다. 발행 전에 운영자에게 보이는 요약.

import { execFileSync } from "node:child_process";
import YAML from "yaml";
import { ROOT, loadKitDocs, stageName, type KitDoc } from "./content.ts";

const base = process.argv[2] ?? "origin/main";
const git = (...args: string[]) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });

let baseFiles: string[] = [];
try {
  baseFiles = git("ls-tree", "--name-only", `${base}:content/kits`).split("\n").filter((f) => f.endsWith(".yaml"));
} catch { /* 기준 커밋에 content/kits가 없음 = 전부 새 파일 */ }

if (!baseFiles.length) {
  console.log(`변경 보고서 — 기준 ${base}에 content/kits가 없음(YAML 전환 전 커밋). 비교를 건너뜀.`);
  process.exit(0);
}

const before = new Map<string, KitDoc>();
for (const f of baseFiles) before.set(f.replace(/\.yaml$/, ""), YAML.parse(git("show", `${base}:content/kits/${f}`)) as KitDoc);
const { kits: now, errors } = loadKitDocs();
const after = new Map(now.map((k) => [k.doc.id, k.doc]));

const lines: string[] = [];
const ogNeeded: string[] = [];
const added = [...after.keys()].filter((id) => !before.has(id));
const removed = [...before.keys()].filter((id) => !after.has(id));
let modified = 0, machineOnly = 0;

const J = (x: unknown) => JSON.stringify(x);
const human = (it: Record<string, unknown>) => { const { channel, status, ...rest } = it; return rest; };

for (const [id, a] of [...after].sort(([x], [y]) => x.localeCompare(y))) {
  const b = before.get(id);
  if (!b) { ogNeeded.push(id); continue; }
  const out: string[] = [];
  for (const f of ["title", "grade", "sem", "subject", "unit", "unit_no", "flow", "sort_order", "published"] as const) {
    if (J(a[f]) !== J(b[f])) out.push(`${f}: ${J(b[f])} → ${J(a[f])}`);
  }
  if (a.title !== b.title) ogNeeded.push(id);
  if (J(a.intro.standards) !== J(b.intro.standards)) out.push(`성취기준: ${b.intro.standards.map((s) => s.code).join(", ")} → ${a.intro.standards.map((s) => s.code).join(", ")}${J(b.intro.standards.map((s) => s.code)) === J(a.intro.standards.map((s) => s.code)) ? " (원문 수정)" : ""}`);
  if (J(a.intro.concepts) !== J(b.intro.concepts)) out.push(`핵심 개념·풀이 수정 (풀이 있는 용어 ${b.intro.concepts.filter((c) => c.def).length} → ${a.intro.concepts.filter((c) => c.def).length}/${a.intro.concepts.length})`);
  if (a.intro.core_idea !== b.intro.core_idea || a.intro.core_question !== b.intro.core_question) out.push(`핵심 아이디어·질문 수정`);
  if (J(a.stages) !== J(b.stages)) out.push(`단계: ${b.stages.map(stageName).join(", ")} → ${a.stages.map(stageName).join(", ")}`);

  const bi = new Map(b.items.map((i) => [i.key, i])), ai = new Map(a.items.map((i) => [i.key, i]));
  const add = a.items.filter((i) => !bi.has(i.key)).map((i) => i.key);
  const del = b.items.filter((i) => !ai.has(i.key)).map((i) => i.key);
  const mod = a.items.filter((i) => bi.has(i.key) && J(human(i)) !== J(human(bi.get(i.key)!))).map((i) => i.key);
  const mach = a.items.filter((i) => bi.has(i.key) && J(human(i)) === J(human(bi.get(i.key)!)) && J(i) !== J(bi.get(i.key))).length;
  const reordered = J(a.items.filter((i) => bi.has(i.key)).map((i) => i.key)) !== J(b.items.filter((i) => ai.has(i.key)).map((i) => i.key));
  if (add.length) out.push(`영상 추가 ${add.length}: ${add.join(", ")}`);
  if (del.length) out.push(`영상 삭제 ${del.length}: ${del.join(", ")}`);
  if (mod.length) out.push(`영상 수정 ${mod.length}: ${mod.join(", ")}`);
  if (reordered) out.push(`영상 순서 바뀜`);
  if (J(a.quiz) !== J(b.quiz)) out.push(`퀴즈 ${b.quiz.length} → ${a.quiz.length}문제(수정 포함)`);

  if (out.length) { modified++; lines.push(`■ ${id} 「${a.title}」`, ...out.map((o) => `  · ${o}`)); }
  else if (mach) machineOnly++;
}

console.log(`변경 보고서 — 기준 ${base}`);
console.log(`· 수정 ${modified} · 추가 ${added.length}${added.length ? ` (${added.join(", ")})` : ""} · 삭제 ${removed.length}${removed.length ? ` (${removed.join(", ")})` : ""}${machineOnly ? ` · 영상 점검 기록만 바뀜 ${machineOnly}` : ""}`);
if (errors.length) console.log(`✗ 형식 오류 파일 ${errors.length}: ${errors.map((e) => e.file).join(", ")} — npm run check`);
if (lines.length) console.log("\n" + lines.join("\n"));
console.log(`\nOG 카드: ${ogNeeded.length ? `새로 만들 것 ${ogNeeded.length} (${ogNeeded.length > 8 ? ogNeeded.slice(0, 8).join(", ") + " …" : ogNeeded.join(", ")}) → npm run og` : "바뀐 제목·새 꾸러미 없음 → 생략"}`);
