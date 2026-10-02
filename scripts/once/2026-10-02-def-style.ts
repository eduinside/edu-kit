// 1회용(2026-10-02): 활동형 22개 꾸러미의 핵심 용어 풀이 문체를 흐름형과 같은 "~이에요/예요" 체로(운영자 결정).
// 뜻은 그대로 두고 끝맺음만 바꾼다: "~이다." → 받침 있으면 "이에요." 없으면 "예요.", "나타난다." → "나타나요.",
// "이른다." → "말해요.", "지닌" → "가진".
// 실행: npx tsx scripts/once/2026-10-02-def-style.ts [--dry]

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ROOT, KITS_DIR, loadKitDocs, kitToYaml } from "../content.ts";

const dry = process.argv.includes("--dry");
const activity = Object.keys(JSON.parse(readFileSync(resolve(ROOT, "scripts/once/2026-10-02-concept-src.json"), "utf8")));

const hasBatchim = (ch: string) => { const c = ch.charCodeAt(0) - 0xac00; return c >= 0 && c < 11172 && c % 28 !== 0; };
export function soften(def: string): string {
  let s = def.replace(/지닌/g, "가진");
  if (s.endsWith("나타난다.")) return s.slice(0, -"나타난다.".length) + "나타나요.";
  if (s.endsWith("이른다.")) return s.slice(0, -"이른다.".length) + "말해요.";
  if (s.endsWith("이다.")) { const base = s.slice(0, -"이다.".length); return base + (hasBatchim(base.at(-1)!) ? "이에요." : "예요."); }
  return s;
}

const { kits, errors } = loadKitDocs();
if (errors.length) throw new Error(errors.map((e) => e.file + ": " + e.message).join("\n"));
const seen = new Map<string, string>();
let changed = 0;
for (const { doc } of kits) {
  if (!activity.includes(doc.id)) continue;
  let touched = false;
  for (const c of doc.intro.concepts) {
    if (!c.def) continue;
    const next = soften(c.def);
    if (next === c.def) { if (!/(요|요\.)$/.test(c.def)) console.warn(`⚠ 바꾸지 못함 ${doc.id} ${c.term}: ${c.def}`); continue; }
    seen.set(c.def, next);
    c.def = next; touched = true; changed++;
  }
  if (touched && !dry) writeFileSync(resolve(KITS_DIR, `${doc.id}.yaml`), kitToYaml(doc));
}
for (const [a, b] of seen) console.log(`${a}\n  → ${b}`);
console.log(`\n✓ 풀이 ${changed}개(서로 다른 문장 ${seen.size}개) ${dry ? "— 미리 보기만" : "바꿈"}`);
