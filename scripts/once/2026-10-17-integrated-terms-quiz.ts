// 통합교과 16꾸러미에 핵심 용어 풀이·OX 퀴즈를 넣고, 운영자가 확정한 7개 꾸러미만 공개하고 나머지는 비공개 초안으로 둔다(2026-10-17, Claude 초안 → 운영자 검수).
//   npx tsx scripts/once/2026-10-17-integrated-terms-quiz.ts
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import YAML from "yaml";
import { ROOT, KITS_DIR, KitDocSchema, kitToYaml } from "../content.ts";

const data = JSON.parse(readFileSync(resolve(ROOT, "scripts/once/2026-10-17-integrated-terms-quiz.json"), "utf8")) as Record<string, { concepts: { term: string; def: string }[]; quiz: { statement: string; answer: "O" | "X"; explain?: string }[]; topics?: string[] }>;
const PUBLISHED = new Set(["in1111", "in1121", "in1131", "in1141", "in1241", "in2111", "in2121"]);
const ids = ["in1111", "in1121", "in1131", "in1141", "in1211", "in1221", "in1241", "in1231", "in2111", "in2121", "in2131", "in2141", "in2211", "in2231", "in2241", "in2221"];
for (const id of ids) {
  const path = resolve(KITS_DIR, `${id}.yaml`);
  const doc = KitDocSchema.parse(YAML.parse(readFileSync(path, "utf8")));
  const d = data[id];
  if (d) { doc.intro.concepts = d.concepts; doc.quiz = d.quiz; if (d.topics) doc.intro.topics = d.topics; } // 주제 태그(10/18): content/_ref/topics.yaml 어휘
  doc.published = PUBLISHED.has(id) || doc.items.length >= 5; // 운영자 확정(10/17): 7개 공개 + 보완(10/18) 뒤 영상 5편 이상이면 공개
  writeFileSync(path, kitToYaml(doc), "utf8");
  console.log(id, `영상 ${doc.items.length} · 용어 ${doc.intro.concepts.length} · 퀴즈 ${doc.quiz.length} · ${doc.published ? "공개" : "비공개 초안"}`);
}
