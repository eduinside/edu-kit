// 초기 조회수/좋아요(SAMPLE_DATA)를 edukit_stats에 적재하는 SQL을 생성한다.
// 실행: npm run seed:stats  →  db/seed-stats.sql 생성
// 적용: wrangler d1 execute edu-link-db --remote --file=db/seed-stats.sql
// INSERT OR IGNORE 라서 이미 카운트가 있으면 덮어쓰지 않는다(최초 1회용).

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// SAMPLE_DATA.md 기준 초기 카운트 (id → [views, likes])
const SEED: Record<string, [number, number]> = {
  ab12: [342, 57], cd34: [289, 41], ef56: [210, 33], gh78: [198, 28],
  ij90: [176, 22], kl12: [154, 19], mn34: [233, 44], op56: [187, 30],
  qa01: [168, 24], qa02: [142, 18], qa03: [131, 16], qb01: [159, 27],
  qb02: [147, 21],
};

const kits: { id: string }[] = JSON.parse(
  readFileSync(resolve(ROOT, "data/kits.json"), "utf8")
);

const lines = ["-- 자동 생성(seed-stats.ts). 최초 1회 적용용.", "BEGIN TRANSACTION;"];
for (const { id } of kits) {
  const [views, likes] = SEED[id] ?? [0, 0];
  lines.push(
    `INSERT OR IGNORE INTO edukit_stats (kit_id, views, likes) VALUES ('${id}', ${views}, ${likes});`
  );
}
lines.push("COMMIT;\n");

writeFileSync(resolve(ROOT, "db/seed-stats.sql"), lines.join("\n"));
console.log(`✓ db/seed-stats.sql 생성 (${kits.length}행)`);
