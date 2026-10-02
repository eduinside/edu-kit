// 빌드 (Cloudflare Pages prebuild · npm run data): content/kits/*.yaml → 검증·변환·새니타이즈 → data/*.json
// YAML 스키마 오류나 변환 경고가 하나라도 있으면 실패한다(배포 차단). 내용 점검은 npm run check.

import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { ROOT, loadKitDocs, toSheetRows } from "./content.ts";
import { transform } from "./transform.ts";

const OUT = resolve(ROOT, "data");

const { kits: loaded, errors } = loadKitDocs();
for (const e of errors) console.error(`✗ [data] ${e.file}: ${e.message}`);

const out = transform(toSheetRows(loaded.map((k) => k.doc)));
for (const w of out.warnings) console.error(`✗ [data] ${w}`);

if (errors.length || out.warnings.length) {
  console.error(`✗ [data] 오류 ${errors.length + out.warnings.length}건 — 고친 뒤 다시 빌드하세요. (npm run check로 자세히)`);
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });
writeFileSync(resolve(OUT, "kits.json"), JSON.stringify(out.kits, null, 2) + "\n");
writeFileSync(resolve(OUT, "items.json"), JSON.stringify(out.items, null, 2) + "\n");
writeFileSync(resolve(OUT, "stage_meta.json"), JSON.stringify(out.stageMeta, null, 2) + "\n");
writeFileSync(resolve(OUT, "quiz.json"), JSON.stringify(out.quiz, null, 2) + "\n");

console.log(`✓ kits: ${out.kits.length} (공개 ${out.kits.filter((k) => k.published).length})`);
console.log(`✓ items: ${out.items.length}`);
console.log(`✓ stage_meta: ${out.stageMeta.length}`);
console.log(`✓ quiz: ${out.quiz.length}`);
console.log(`→ data/kits.json · items.json · stage_meta.json · quiz.json`);
