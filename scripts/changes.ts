// 변경 문서 — npm run changes -- <기준 커밋> <이름> [사유.json]
// 기준 커밋의 content/kits와 지금 작업본을 비교해 docs/changes/<이름>.md(요약)·.csv(전체 행)를 만든다.
// 배포할 때 "원본과 무엇이 달라졌는지"를 운영자·협업자에게 넘기는 문서. 기계가 채우는 channel·status는 요약 숫자만.
//
// 사유.json(선택): { "<kit>/<key>": "...", "<kit>:<구분>": "...", "<구분>": "..." } — 앞에서부터 찾아 맞는 것을 쓴다.

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import YAML from "yaml";
import { ROOT, loadKitDocs, stageName, type KitDoc } from "./content.ts";

const [base, name, notesFile] = process.argv.slice(2);
if (!base || !name) { console.error("사용법: npm run changes -- <기준 커밋> <이름> [사유.json]"); process.exit(1); }
const notes: Record<string, string> = notesFile ? JSON.parse(readFileSync(resolve(ROOT, notesFile), "utf8")) : {};

const git = (...a: string[]) => execFileSync("git", a, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 << 20 });
const before = new Map<string, KitDoc>();
for (const f of git("ls-tree", "--name-only", `${base}:content/kits`).split("\n").filter((f) => f.endsWith(".yaml"))) {
  before.set(f.replace(/\.yaml$/, ""), YAML.parse(git("show", `${base}:content/kits/${f}`)) as KitDoc);
}
const { kits, errors } = loadKitDocs();
if (errors.length) { console.error(errors.map((e) => `${e.file}: ${e.message}`).join("\n")); process.exit(1); }
const after = new Map(kits.map((k) => [k.doc.id, k.doc]));

interface Row { kit: string; unit: string; cat: string; item: string; before: string; after: string; note: string }
const rows: Row[] = [];
const label = (d: KitDoc) => `${d.grade}-${d.sem} ${d.subject} 「${d.title}」`;
const noteFor = (kit: string, item: string, cat: string) => notes[`${kit}/${item}`] ?? notes[`${kit}:${cat}`] ?? notes[cat] ?? "";
const add = (d: KitDoc, cat: string, item: string, b: string, a: string) =>
  rows.push({ kit: d.id, unit: label(d), cat, item, before: b, after: a, note: noteFor(d.id, item, cat) });
const vid = (u: string) => (u.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{11})/) ?? [])[1] ?? u;

// 영상이 옮겨 갔는지 찾기 위한 색인: 영상 ID → 지금 위치들
const nowAt = new Map<string, { kit: string; key: string }[]>();
for (const d of after.values()) for (const it of d.items) (nowAt.get(vid(it.url)) ?? nowAt.set(vid(it.url), []).get(vid(it.url))!).push({ kit: d.id, key: it.key });
const movedIn = new Set<string>();
const incoming = new Map<string, number>();
let channelAdded = 0;

for (const id of [...new Set([...before.keys(), ...after.keys()])].sort()) {
  const b = before.get(id), a = after.get(id);
  if (!b) { add(a!, "꾸러미 추가", id, "", a!.title); continue; }
  if (!a) { add(b, "꾸러미 삭제", id, b.title, ""); continue; }

  for (const f of ["title", "grade", "sem", "subject", "unit", "unit_no", "flow", "sort_order", "published"] as const) {
    if (String(b[f]) !== String(a[f])) add(a, "꾸러미 정보", f, String(b[f]), String(a[f]));
  }
  if (b.intro.core_idea !== a.intro.core_idea) add(a, "핵심 아이디어", "core_idea", b.intro.core_idea, a.intro.core_idea);
  if (b.intro.core_question !== a.intro.core_question) add(a, "핵심 질문", "core_question", b.intro.core_question, a.intro.core_question);

  const sb = b.intro.standards, sa = a.intro.standards;
  for (let i = 0; i < Math.max(sb.length, sa.length); i++) {
    const x = sb[i], y = sa[i];
    if (x?.code !== y?.code || x?.text !== y?.text) add(a, "성취기준", y?.code ?? x?.code ?? "", x ? `${x.code} ${x.text}` : "", y ? `${y.code} ${y.text}` : "");
  }

  const cb = b.intro.concepts, ca = a.intro.concepts;
  for (let i = 0; i < Math.max(cb.length, ca.length); i++) {
    const x = cb[i], y = ca[i];
    if (x?.term !== y?.term) add(a, "핵심 용어", y?.term ?? x?.term ?? "", x?.term ?? "", y?.term ?? "");
    if ((x?.def ?? "") !== (y?.def ?? "")) add(a, x?.def ? "용어 풀이 수정" : "용어 풀이 추가", y?.term ?? x?.term ?? "", x?.def ?? "", y?.def ?? "");
  }

  const stb = b.stages.map(stageName).join(", "), sta = a.stages.map(stageName).join(", ");
  if (stb !== sta) add(a, "단계", "stages", stb || "(없음)", sta || "(없음)");

  const ai = new Map(a.items.map((i) => [i.key, i]));
  for (const x of b.items) {
    const y = ai.get(x.key);
    if (y && vid(y.url) === vid(x.url)) {
      if (x.title !== y.title) add(a, "목차 제목", x.key, x.title, y.title);
      // 영상 머리 제목은 비어 있으면 목차 제목과 같다 — 실제로 보이는 값끼리 비교
      if ((x.video_title ?? x.title) !== (y.video_title ?? y.title)) add(a, "영상 제목", x.key, x.video_title ?? x.title, y.video_title ?? y.title);
      for (const [f, cat] of [["use", "쓰임"], ["desc", "영상 설명"], ["start", "재생 구간"], ["end", "재생 구간"]] as const) {
        if (String(x[f] ?? "") !== String(y[f] ?? "")) add(a, cat, x.key, String(x[f] ?? ""), String(y[f] ?? ""));
      }
      if ((x.embed === false) !== (y.embed === false)) add(a, "재생 설정", x.key, x.embed === false ? "유튜브에서 열기(임베드 차단)" : "사이트 안 재생", y.embed === false ? "유튜브에서 열기(임베드 차단)" : "사이트 안 재생");
      if (!x.channel && y.channel) channelAdded++;
      continue;
    }
    if (y) { add(a, "영상 주소", x.key, `${x.title} | ${x.url}`, `${y.title} | ${y.url}`); continue; }
    const dest = (nowAt.get(vid(x.url)) ?? []).find((p) => p.kit !== id && !before.get(p.kit)?.items.some((i) => i.key === p.key));
    if (dest) {
      movedIn.add(`${dest.kit}/${dest.key}`);
      incoming.set(dest.kit, (incoming.get(dest.kit) ?? 0) + 1);
      add(b, "영상 옮김", x.key, `${id}/${x.key} [${x.stage}] ${x.title}`, `${dest.kit}/${dest.key} 「${after.get(dest.kit)!.title}」`);
    } else {
      add(b, "영상 뺌", x.key, `[${x.stage}] ${x.title} | ${x.url}`, "");
    }
  }
  const bi = new Set(b.items.map((i) => i.key));
  for (const y of a.items) if (!bi.has(y.key) && !movedIn.has(`${id}/${y.key}`)) {
    // 이 꾸러미로 옮겨 온 영상은 위에서 나간 쪽 행으로 이미 적었다(아직 처리 안 된 꾸러미 순서일 수 있어 아래에서 한 번 더 거른다)
    add(a, "영상 추가", y.key, "", `[${y.stage}] ${y.title} | ${y.url}`);
  }

  const qb = b.quiz.map((q) => `${q.answer} ${q.statement}`), qa = a.quiz.map((q) => `${q.answer} ${q.statement}`);
  for (const q of qb) if (!qa.includes(q)) add(a, "퀴즈 뺌", "", q, "");
  for (const q of qa) if (!qb.includes(q)) add(a, "퀴즈 추가", "", "", q);
}
// 옮겨 온 영상이 "영상 추가"로 먼저 적힌 경우를 걷어 낸다(꾸러미 이름 순서 때문)
const final = rows.filter((r) => !(r.cat === "영상 추가" && movedIn.has(`${r.kit}/${r.item}`)));

// ── 쓰기
const OUT = resolve(ROOT, "docs/changes");
mkdirSync(OUT, { recursive: true });
const csvCell = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
const csv = ["꾸러미,단원,구분,항목,원본,변경,사유", ...final.map((r) => [r.kit, r.unit, r.cat, r.item, r.before, r.after, r.note].map(csvCell).join(","))].join("\r\n");
writeFileSync(resolve(OUT, `${name}.csv`), "﻿" + csv + "\r\n");

const count = (rs: Row[]) => { const m = new Map<string, number>(); for (const r of rs) m.set(r.cat, (m.get(r.cat) ?? 0) + 1); return m; };
const total = count(final);
const byKit = new Map<string, Row[]>();
for (const r of final) (byKit.get(r.kit) ?? byKit.set(r.kit, []).get(r.kit)!).push(r);
const baseShort = git("rev-parse", "--short", base).trim();
const md = [
  `# 원본 대비 변경 — ${name}`,
  "",
  `- 기준(원본): \`${baseShort}\` 의 \`content/kits\` · 비교: 이 문서와 함께 배포된 꾸러미 파일`,
  `- 전체 행: [${name}.csv](${encodeURI(name)}.csv) (엑셀·구글 시트에서 열림, ${final.length}행)`,
  `- 만든 명령: \`npm run changes -- ${base} ${name}${notesFile ? " " + notesFile : ""}\``,
  `- 영상 출처(채널명)는 기계가 채우는 칸이라 행 목록에 넣지 않았다. 지금 ${[...after.values()].reduce((n, d) => n + d.items.filter((i) => i.channel).length, 0)}개 영상에 기록돼 있고(기준 대비 새로 ${channelAdded}개), 사이트 영상 설명 아래 "출처"로 보인다.`,
  "- \"영상 옮김\" 행은 영상이 **나간** 꾸러미에 적었다. 들어온 쪽은 아래 꾸러미별 표의 \"들어옴\" 숫자로 보인다.",
  "",
  "## 구분별",
  "",
  "| 구분 | 건수 |",
  "|---|---:|",
  ...[...total].sort((x, y) => y[1] - x[1]).map(([c, n]) => `| ${c} | ${n} |`),
  "",
  "## 꾸러미별",
  "",
  "| 꾸러미 | 단원 | 바뀐 것 |",
  "|---|---|---|",
  ...[...new Set([...byKit.keys(), ...incoming.keys()])].sort().map((kit) => {
    const rs = byKit.get(kit) ?? [];
    const parts = [...count(rs)].map(([c, n]) => (c === "영상 옮김" ? `영상 옮김(나감) ${n}` : `${c} ${n}`));
    if (incoming.get(kit)) parts.push(`영상 옮김(들어옴) ${incoming.get(kit)}`);
    return `| ${kit} | ${rs[0]?.unit ?? label(after.get(kit)!)} | ${parts.join(" · ")} |`;
  }),
  "",
  "## 주요 변경(용어 풀이 문장 제외)",
  "",
  ...[...byKit].flatMap(([kit, rs]) => {
    const main = rs.filter((r) => !r.cat.startsWith("용어 풀이"));
    if (!main.length) return [];
    const notes = [...new Set(main.map((r) => r.note).filter(Boolean))];
    return [`### ${kit} ${rs[0].unit}`, ...main.map((r) => `- **${r.cat}** ${r.item ? `\`${r.item}\` ` : ""}${r.before ? `${r.before}` : ""}${r.before && r.after ? " → " : ""}${r.after}`), ...(notes.length ? [`  - 사유: ${notes.join(" / ")}`] : []), ""];
  }),
].filter((l) => l !== undefined).join("\n");
writeFileSync(resolve(OUT, `${name}.md`), md + "\n");
console.log(`✓ docs/changes/${name}.md · .csv — ${final.length}행 (${[...total].map(([c, n]) => `${c} ${n}`).join(", ")})`);
