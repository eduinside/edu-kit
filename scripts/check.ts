// 발행 전 점검 — npm run check  (특정 꾸러미만: npm run check -- so5121 sc5111)
// ✗ 오류: 발행하면 안 됨(종료 코드 1) · ⚠ 경고: 확인 필요 · · 참고: 숫자만 보고
// 항목은 docs/OPERATIONS.md §4.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ROOT, loadKitDocs, toSheetRows, stageName, type KitDoc } from "./content.ts";
import { transform } from "./transform.ts";
import { extractVideoId } from "./field-map.ts";

type Level = "error" | "warn";
const found: { level: Level; kit: string; msg: string }[] = [];
const err = (kit: string, msg: string) => found.push({ level: "error", kit, msg });
const warn = (kit: string, msg: string) => found.push({ level: "warn", kit, msg });

const only = new Set(process.argv.slice(2).filter((a) => !a.startsWith("-")));

// ── 1. 읽기 + 스키마
const { kits: loaded, errors } = loadKitDocs();
for (const e of errors) err(e.file.replace(/\.yaml$/, ""), `파일 형식: ${e.message}`);
const docs = loaded.map((k) => k.doc);

// ── 2. 빌드 변환(사이트 데이터로 바꿀 때 건너뛰는 행이 있으면 오류)
for (const w of transform(toSheetRows(docs)).warnings) err("빌드", w);

// ── 3. 성취기준 기준표(2022 사회·과학)
const ref = JSON.parse(readFileSync(resolve(ROOT, "content/_ref/standards-2022.json"), "utf8")) as {
  standards: { code: string; subject: string; gradeBand: string; text: string }[];
};
const refByCode = new Map(ref.standards.map((s) => [s.code, s]));
const bandOf = (grade: number) => (grade <= 4 ? "3-4" : "5-6");
const loose = (s: string) => s.replace(/[⋅․•∙]/g, "·").replace(/\s+/g, "").replace(/[.。]$/, "");
const tight = (s: string) => s.replace(/\s+/g, " ").trim();

const codeUsers = new Map<string, string[]>();
const ALLOWED_USE = new Set(["수업 전", "수업 중", "수업 후", "배경지식"]);
const BAD_STATUS = new Set(["삭제·비공개", "비공개", "연령제한", "국내차단", "URL오류"]);
const norm = (s: string) => s.replace(/\s+/g, "");

let noUse = 0, noChannel = 0, termsNoDef = 0;
const videoKits = new Map<string, Set<string>>();
const statements = new Map<string, string[]>();

for (const d of docs) {
  const K = d.id;

  // 성취기준
  for (const s of d.intro.standards) {
    (codeUsers.get(s.code) ?? codeUsers.set(s.code, []).get(s.code)!).push(K);
    if (/[–—−]/.test(s.code)) { err(K, `성취기준 코드에 줄표(–) ${s.code} — 하이픈(-)으로`); continue; }
    const r = refByCode.get(s.code);
    if (!r) { err(K, `성취기준 코드 ${s.code}가 2022 사회·과학 목록에 없음`); continue; }
    if (r.subject !== d.subject) err(K, `성취기준 ${s.code}는 ${r.subject} — 꾸러미 교과(${d.subject})와 다름`);
    if (r.gradeBand !== bandOf(d.grade)) err(K, `성취기준 ${s.code}는 ${r.gradeBand}학년군 — 꾸러미 ${d.grade}학년과 맞지 않음`);
    if (tight(s.text) !== tight(r.text)) {
      if (loose(s.text) === loose(r.text)) warn(K, `성취기준 ${s.code} 원문과 표기만 다름(가운뎃점·마침표·띄어쓰기) → 원문: ${r.text}`);
      else warn(K, `성취기준 ${s.code} 원문과 다름\n      꾸러미: ${s.text}\n      원문:   ${r.text}`);
    }
  }

  // 핵심 개념
  const terms = d.intro.concepts.map((c) => c.term);
  const missingDef = d.intro.concepts.filter((c) => !c.def).length;
  termsNoDef += missingDef;
  if (missingDef) warn(K, `핵심 용어 풀이 없음 ${missingDef}/${terms.length} — 사이트에서 용어를 눌러도 풀이가 안 나옴`);
  const dupTerm = terms.filter((t, i) => terms.indexOf(t) !== i);
  if (dupTerm.length) warn(K, `핵심 용어 중복: ${[...new Set(dupTerm)].join(", ")}`);

  // 단계·영상
  const stageNames = d.stages.map(stageName);
  const dupStage = stageNames.filter((s, i) => stageNames.indexOf(s) !== i);
  if (dupStage.length) err(K, `단계 이름 중복: ${[...new Set(dupStage)].join(", ")}`);
  const used = new Set(d.items.map((i) => i.stage));
  for (const s of stageNames) if (!used.has(s)) warn(K, `영상 없는 단계: ${s}`);

  // 흐름형: 핵심 개념과 영상 단계(핵심어)가 하나도 안 겹치면 다른 단원 영상일 가능성
  if (d.flow === "flow" && terms.length) {
    const overlap = stageNames.filter((s) => terms.some((t) => norm(s).includes(norm(t)) || norm(t).includes(norm(s))));
    if (!overlap.length) warn(K, `핵심 개념(${terms.join(", ")})과 영상 단계(${stageNames.join(", ")})가 하나도 안 겹침 — 다른 단원 영상일 수 있음`);
  }

  const seenVid = new Map<string, string>();
  const keys = new Set<string>();
  for (const it of d.items) {
    const at = `${K}/${it.key}`;
    if (keys.has(it.key)) err(K, `영상 key 중복: ${it.key}`);
    keys.add(it.key);
    if (!stageNames.includes(it.stage)) err(K, `${it.key}: 단계 "${it.stage}"가 stages에 없음`);
    if (/\s|[\u0000-\u001f]/.test(it.url)) err(K, `${it.key}: 주소에 공백·제어 문자`);
    const vid = extractVideoId(it.url);
    if (!vid) { err(K, `${it.key}: 유튜브 주소에서 영상 ID를 못 뽑음`); continue; }
    if (seenVid.has(vid)) warn(K, `같은 영상 두 번: ${seenVid.get(vid)} · ${it.key}`);
    seenVid.set(vid, it.key);
    (videoKits.get(vid) ?? videoKits.set(vid, new Set()).get(vid)!).add(K);
    if (it.video_title && it.video_title !== it.title) warn(K, `${it.key}: 목차 제목 "${it.title}" ↔ 영상 제목 "${it.video_title}"`);
    if (it.use && !ALLOWED_USE.has(it.use)) warn(K, `${it.key}: 쓰임 "${it.use}"은 정해진 값(수업 전·수업 중·수업 후·배경지식)이 아님`);
    if (d.flow === "flow" && !it.use) noUse++;
    if (d.flow === "activity") noUse++;
    if (!it.channel) noChannel++;
    if (it.status && BAD_STATUS.has(it.status)) err(K, `${it.key}: 영상 상태 ${it.status} — 교체 필요 (${at})`);
    else if (it.status === "임베드차단" && it.embed !== false) warn(K, `${it.key}: 임베드차단 — 교체하거나 embed: false`);
    else if (!it.status && it.embed === false && it.channel) warn(K, `${it.key}: embed: false인데 마지막 점검에서는 삽입 재생이 됨 — YouTube API 점검으로 확인 뒤 지울 수 있음`);
    if (it.start !== undefined && it.end !== undefined && it.end <= it.start) err(K, `${it.key}: 구간 끝(${it.end})이 시작(${it.start})보다 빠름`);
  }
  if (d.published && !d.items.length) warn(K, `공개 꾸러미인데 영상이 없음`);

  // 퀴즈
  if (d.published && d.quiz.length < 2) warn(K, `퀴즈 ${d.quiz.length}문제 — 2문제 미만이면 퀴즈 화면이 안 나옴`);
  const o = d.quiz.filter((q) => q.answer === "O").length;
  if (d.quiz.length >= 4 && (o === 0 || o === d.quiz.length)) warn(K, `퀴즈 정답이 모두 ${o ? "O" : "X"}`);
  const stmts = d.quiz.map((q) => q.statement);
  for (const s of new Set(stmts.filter((s, i) => stmts.indexOf(s) !== i))) warn(K, `같은 퀴즈 문장 두 번: ${s}`);
  for (const s of stmts) (statements.get(s) ?? statements.set(s, []).get(s)!).push(K);
}

for (const [code, users] of codeUsers) {
  const u = [...new Set(users)];
  if (u.length > 1) for (const k of u) warn(k, `성취기준 ${code}를 다른 꾸러미(${u.filter((x) => x !== k).join(", ")})도 씀 — 단원에 맞는 코드인지 확인`);
}
for (const [s, ks] of statements) {
  const u = [...new Set(ks)];
  if (u.length > 1) for (const k of u) warn(k, `퀴즈 문장이 다른 꾸러미(${u.filter((x) => x !== k).join(", ")})와 같음: ${s}`);
}

// ── 출력
const show = found.filter((f) => !only.size || only.has(f.kit) || f.kit === "빌드");
const byKit = new Map<string, typeof show>();
for (const f of show) (byKit.get(f.kit) ?? byKit.set(f.kit, []).get(f.kit)!).push(f);
for (const [kit, list] of [...byKit].sort(([a], [b]) => a.localeCompare(b))) {
  const d = docs.find((x) => x.id === kit) as KitDoc | undefined;
  console.log(`\n■ ${kit}${d ? ` ${d.grade}-${d.sem} ${d.subject} 「${d.title}」` : ""}`);
  for (const f of list.sort((a, b) => (a.level === b.level ? 0 : a.level === "error" ? -1 : 1))) console.log(`  ${f.level === "error" ? "✗" : "⚠"} ${f.msg}`);
}

const nErr = show.filter((f) => f.level === "error").length;
const nWarn = show.filter((f) => f.level === "warn").length;
const nVideos = docs.reduce((a, d) => a + d.items.length, 0);
const reused = [...videoKits.values()].filter((s) => s.size > 1).length;
console.log(`\n── 요약: 꾸러미 ${docs.length} · 영상 ${nVideos} · 퀴즈 ${docs.reduce((a, d) => a + d.quiz.length, 0)}`);
console.log(`   ✗ 오류 ${nErr} · ⚠ 경고 ${nWarn}`);
let lastCheck = "기록 없음";
try {
  const vc = JSON.parse(readFileSync(resolve(ROOT, "content/_ref/video-check.json"), "utf8")) as { date: string; mode: string };
  lastCheck = `${vc.date} (${vc.mode})`;
} catch { /* 아직 점검 전 */ }
console.log(`   · 쓰임 빈칸 ${noUse} · 채널 미기록 ${noChannel} · 풀이 없는 용어 ${termsNoDef} · 여러 꾸러미가 같이 쓰는 영상 ${reused}`);
console.log(`   · 마지막 영상 점검(npm run videos): ${lastCheck}`);
process.exit(nErr ? 1 : 0);
