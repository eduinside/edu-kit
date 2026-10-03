// 공개 카탈로그 — 수업나래(실생활 맥락 탐구자료)가 빌드 때 받아 가는 꾸러미 영상 목록.
// build-data가 public/catalog.json으로 쓰고(→ kit.dgedu.link/catalog.json), check가 채널 등급 표 빈칸을 경고한다.
// 계획: dge-narae docs/plans/REAL-LIFE-MATERIALS-PLAN.md §2 K1·K2
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import YAML from "yaml";
import { ROOT, stageName, type KitDoc } from "./content.ts";

export const GRADES = ["public", "edu", "press", "personal"] as const;
export type Grade = (typeof GRADES)[number];
export const GRADE_LABEL: Record<Grade, string> = { public: "공공", edu: "교육", press: "언론·방송", personal: "개인 제작" };
export const CHANNELS_FILE = resolve(ROOT, "content/channels.yaml");

/** content/channels.yaml → 채널 이름 → 등급. 한 채널이 두 등급에 있으면 오류. */
export function loadChannelGrades(): { grades: Map<string, Grade>; errors: string[] } {
  const grades = new Map<string, Grade>();
  const errors: string[] = [];
  if (!existsSync(CHANNELS_FILE)) return { grades, errors: ["content/channels.yaml 없음"] };
  const doc = (YAML.parse(readFileSync(CHANNELS_FILE, "utf8")) ?? {}) as Record<string, unknown>;
  for (const [g, list] of Object.entries(doc)) {
    if (!(GRADES as readonly string[]).includes(g)) { errors.push(`channels.yaml: 모르는 등급 "${g}"`); continue; }
    for (const ch of Array.isArray(list) ? list : []) {
      if (typeof ch !== "string") continue;
      if (grades.has(ch) && grades.get(ch) !== g) errors.push(`channels.yaml: "${ch}"가 ${grades.get(ch)}·${g} 두 곳에 있음`);
      grades.set(ch, g as Grade);
    }
  }
  return { grades, errors };
}

const dash = (s: string) => s.replace(/[‐-―−]/g, "-").trim();

function commit(): string | null {
  const env = process.env.CF_PAGES_COMMIT_SHA;
  if (env) return env.slice(0, 7);
  try { return execSync("git rev-parse --short HEAD", { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch { return null; }
}

/** 공개 꾸러미 · 재생 가능한 영상만. 등급 표에 없는 채널은 personal(개인 제작)로 둔다(check가 경고). */
export function buildCatalog(docs: KitDoc[], grades: Map<string, Grade>) {
  const kits = docs.filter((d) => d.published).sort((a, b) => a.id.localeCompare(b.id));
  const body = {
    grades: GRADE_LABEL,
    kits: kits.map((d) => ({
      id: d.id, title: d.title, grade: d.grade, sem: d.sem, subject: d.subject, unit: d.unit, flow: d.flow,
      standards: d.intro.standards.map((s) => ({ code: dash(s.code), text: s.text })),
      coreQuestion: d.intro.core_question,
      concepts: d.intro.concepts.map((c) => c.term),
      stages: d.stages.map(stageName),
    })),
    items: kits.flatMap((d) => d.items
      .filter((it) => !it.status && it.embed !== false)
      .map((it) => ({
        ref: `${d.id}.${it.key}`, kit: d.id, key: it.key, title: it.title, stage: it.stage,
        use: it.use ?? null, desc: it.desc ?? null, channel: it.channel ?? null,
        grade: (it.channel && grades.get(it.channel)) || "personal",
        ...(it.start != null ? { start: it.start } : {}), ...(it.end != null ? { end: it.end } : {}),
      }))),
  };
  const hash = createHash("sha256").update(JSON.stringify(body)).digest("hex").slice(0, 12);
  return { version: { hash, commit: commit(), builtAt: new Date().toISOString() }, ...body };
}
