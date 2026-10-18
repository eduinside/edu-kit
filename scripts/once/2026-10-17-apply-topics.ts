// 한 번 쓰는 스크립트(2026-10-17) — 주제 태그 초안(JSON, Claude 서브에이전트가 핵심 질문·용어·영상 제목으로 씀)을
// content/kits/*.yaml의 intro.topics에 넣는다. 파일은 통째로 다시 쓰지 않고 `  standards:` 줄 앞에 topics 블록만 끼운다
// (kitToYaml은 원본과 바이트가 달라 차이가 커진다). 어휘(content/_ref/topics.yaml) 밖 태그는 멈춘다.
//   npx tsx scripts/once/2026-10-17-apply-topics.ts <draft.json …>   draft.json = {"topics": {"<id>": ["태그", …]}}
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import YAML from "yaml";
import { ROOT, KITS_DIR } from "../content.ts";

const vocab = new Set((YAML.parse(readFileSync(resolve(ROOT, "content/_ref/topics.yaml"), "utf8")) as { groups: { tags: string[] }[] }).groups.flatMap((g) => g.tags));
// 서브에이전트가 "어휘에 없어 가까운 말로 대신했다"고 적은 것 — 어휘에 더한 뒤 그 꾸러미에 붙인다(앞에 둔다). 뺄 것은 "-태그"
const FIX: Record<string, string[]> = {
  so5121: ["기후"], so6212: ["기후"], sc4241: ["기후"],
  so5112: ["독도", "영토"], so6132: ["영토"], so5132: ["헌법"], so4221: ["문제 해결"], so3221: ["명절"], so5221: ["한글"], so3121: ["연표"],
  sc3111: ["무게", "-선사 시대", "-옛날과 오늘날"], sc4131: ["암석"], sc5111: ["암석"], sc4211: ["우주"], sc4221: ["먹이 사슬"],
  sc4141: ["현미경"], sc6131: ["현미경"], sc6241: ["인공지능"],
};

const draft: Record<string, string[]> = {};
for (const f of process.argv.slice(2)) Object.assign(draft, (JSON.parse(readFileSync(f, "utf8")) as { topics: Record<string, string[]> }).topics);

let n = 0;
for (const [id, raw] of Object.entries(draft).sort(([a], [b]) => a.localeCompare(b))) {
  const file = resolve(KITS_DIR, `${id}.yaml`);
  if (!existsSync(file)) throw new Error(`${id}: 파일 없음`);
  let tags = [...raw];
  for (const fx of FIX[id] ?? []) {
    if (fx.startsWith("-")) tags = tags.filter((t) => t !== fx.slice(1));
    else if (!tags.includes(fx)) tags.unshift(fx);
  }
  tags = [...new Set(tags)].slice(0, 10);
  const bad = tags.filter((t) => !vocab.has(t));
  if (bad.length) throw new Error(`${id}: 어휘에 없는 태그 ${bad.join(", ")}`);
  if (tags.length < 3) throw new Error(`${id}: 태그 ${tags.length}개`);
  const src = readFileSync(file, "utf8");
  const eol = src.includes("\r\n") ? "\r\n" : "\n";
  if (/^  topics:/m.test(src)) throw new Error(`${id}: topics가 이미 있음`);
  const anchor = `${eol}  standards:${eol}`;
  if (src.split(anchor).length !== 2) throw new Error(`${id}: intro.standards 줄을 찾지 못함`);
  const block = `${eol}  topics:${eol}${tags.map((t) => `    - ${t}`).join(eol)}`;
  writeFileSync(file, src.replace(anchor, `${block}${anchor}`));
  n++;
}
console.log(`topics 넣음 ${n}개 꾸러미 (어휘 ${vocab.size}개 태그)`);
