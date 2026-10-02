// 1회용(2026-10-02): 원본 시트 점검에서 찾은 결함 정리(docs/IMPROVEMENT_PLAN_claude-ops.md §1-1, §7).
// 운영자 결정: 인구·인권·헌법 영상은 맞는 단원으로 옮기고, 기후·지층과 화석 영상은 비워 두며, 국내차단 영상은 뺀다.
// 영상을 옮길 때는 받는 꾸러미에서 쓰지 않은 다음 key를 준다(옛 공유 링크가 다른 영상으로 가지 않게).

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ROOT, KITS_DIR, loadKitDocs, kitToYaml, stageName, type KitDoc, type VideoItem } from "../content.ts";

const { kits, errors } = loadKitDocs();
if (errors.length) throw new Error(errors.map((e) => `${e.file}: ${e.message}`).join("\n"));
const by = new Map(kits.map((k) => [k.doc.id, k.doc]));
const K = (id: string) => { const d = by.get(id); if (!d) throw new Error(`없는 꾸러미 ${id}`); return d; };
const touched = new Set<string>();
const log: string[] = [];

const nextKey = (d: KitDoc, retired: string[]) => {
  let n = Math.max(0, ...[...d.items.map((i) => i.key), ...retired].map((k) => Number(k.replace(/^v0*/, "")) || 0));
  const pad = d.items.some((i) => /^v0\d/.test(i.key)) ? 2 : 0;
  return () => `v${String(++n).padStart(pad, "0")}`;
};

/** from의 해당 단계 영상을 to 끝으로 옮긴다(단계도 to에 없으면 끝에 붙임). */
function move(fromId: string, toId: string, stages: string[], retiredInTo: string[]) {
  const from = K(fromId), to = K(toId);
  const next = nextKey(to, retiredInTo);
  const moving = from.items.filter((i) => stages.includes(i.stage));
  for (const it of moving) {
    const newKey = next();
    to.items.push({ ...it, key: newKey });
    log.push(`옮김 ${fromId}/${it.key} → ${toId}/${newKey} (${it.stage}) ${it.title}`);
  }
  from.items = from.items.filter((i) => !stages.includes(i.stage));
  for (const s of stages) if (!to.stages.map(stageName).includes(s)) to.stages.push(s);
  touched.add(fromId); touched.add(toId);
}
function dropStages(id: string, stages: string[], why: string) {
  const d = K(id);
  for (const it of d.items.filter((i) => stages.includes(i.stage))) log.push(`뺌 ${id}/${it.key} (${it.stage}) ${it.title} — ${why}`);
  d.items = d.items.filter((i) => !stages.includes(i.stage));
  touched.add(id);
}
function dropItem(id: string, key: string, why: string) {
  const d = K(id);
  const it = d.items.find((i) => i.key === key);
  if (!it) throw new Error(`${id}/${key} 없음`);
  log.push(`뺌 ${id}/${key} ${it.title} — ${why}`);
  d.items = d.items.filter((i) => i.key !== key);
  touched.add(id);
}
const setStages = (id: string, names: string[]) => { K(id).stages = names; touched.add(id); };

// ── 결함 1: 5학년 1학기 — 2015 교육과정 단원 영상이 남아 있던 꾸러미
// 옮기는 순서가 중요하다(받는 쪽의 기존 영상을 먼저 비운다).
const retired = (id: string) => K(id).items.map((i) => i.key); // 비우기 전 key = 다시 쓰지 않을 key
const r5132 = retired("so5132"), r5131 = retired("so5131"), r5122 = retired("so5122");
move("so5131", "so5132", ["헌법", "기본권", "의무"], r5132);          // 헌법 영상 → 법 단원
setStages("so5131", []);
move("so5122", "so5131", ["인권", "인권신장", "인권침해", "인권보호"], r5131); // 인권 영상 → 인권 단원
setStages("so5122", []);
move("so5121", "so5122", ["인구분포", "인구구조", "도시발달"], r5122);   // 인구 영상 → 인구 분포 단원
dropStages("so5121", ["산업구조", "교통발달"], "2022 「인구 분포」 성취기준 밖(옛 '국토의 인문환경' 단원) — 다른 단원 활용은 운영자 판단");
setStages("so5121", []);                                                 // 기후 영상은 당분간 비워 둔다
dropStages("sc5111", ["온도", "열의 이동", "전도", "대류", "단열"], "「지층과 화석」과 무관(옛 「온도와 열」 단원 영상)");
setStages("sc5111", []);                                                 // 지층·화석 영상은 당분간 비워 둔다

// ── 결함 2·9: 목차 제목이 영상 제목과 다름 → 영상 제목으로
for (const d of by.values()) {
  for (const it of d.items) {
    if (it.video_title && it.video_title !== it.title) {
      log.push(`제목 ${d.id}/${it.key}: "${it.title}" → "${it.video_title}"`);
      it.title = it.video_title;
      delete it.video_title;
      touched.add(d.id);
    }
  }
}

// ── 결함 3·5: 성취기준 — so5232 코드 오기, 줄표, 원문 표기
const ref = JSON.parse(readFileSync(resolve(ROOT, "content/_ref/standards-2022.json"), "utf8")) as { standards: { code: string; text: string }[] };
const refText = new Map(ref.standards.map((s) => [s.code, s.text]));
K("so5232").intro.standards = [{ code: "[6사06-02]", text: refText.get("[6사06-02]")! }];
log.push(`성취기준 so5232: [6사07-01] → [6사06-02]`); touched.add("so5232");
const loose = (s: string) => s.replace(/[⋅․•∙]/g, "·").replace(/\s+/g, "").replace(/[.。]$/, "");
for (const d of by.values()) {
  for (const s of d.intro.standards) {
    const code = s.code.replace(/[–—−]/g, "-");
    if (code !== s.code) { log.push(`성취기준 ${d.id}: ${s.code} → ${code}`); s.code = code; touched.add(d.id); }
    const t = refText.get(s.code);
    if (t && s.text !== t && loose(s.text) === loose(t)) { log.push(`성취기준 원문 표기 ${d.id} ${s.code}`); s.text = t; touched.add(d.id); }
  }
}

// ── 결함 4: 활동형 22개 용어 풀이 — 원본 시트 concept_src 탭(시트 스냅샷에서 뽑음)
const src = JSON.parse(readFileSync(resolve(ROOT, "scripts/once/2026-10-02-concept-src.json"), "utf8")) as Record<string, string>;
for (const d of by.values()) {
  if (d.intro.concepts.some((c) => c.def) || !src[d.id]) continue;
  const defs = src[d.id].split(";").map((s) => s.trim()).filter(Boolean);
  if (defs.length !== d.intro.concepts.length) throw new Error(`${d.id}: 풀이 ${defs.length} ≠ 용어 ${d.intro.concepts.length}`);
  d.intro.concepts = d.intro.concepts.map((c, i) => ({ term: c.term, def: defs[i] }));
  log.push(`용어 풀이 ${d.id}: ${defs.length}개`); touched.add(d.id);
}

// ── 결함 6(주소 제어 문자)은 전환 때 이미 정리됨. 결함 7: 같은 영상 두 번
{
  const it = K("so3123").items.find((i) => i.key === "v39")!;   // 주소가 v42(월성동)와 같았다 — 같은 시리즈의 수성구 편으로
  it.url = "https://www.youtube.com/watch?v=KksogX2HRp8";       // 「원스어펀어타임 인 대구-수성구」(대구MBC뉴스 백투더투데이)
  delete it.channel; delete it.status;
  log.push(`주소 so3123/v39: 월성동 편 주소가 잘못 들어가 있던 것을 수성구 편(KksogX2HRp8)으로`); touched.add("so3123");
}
dropItem("sc5131", "v4", "v1과 같은 영상(EBS 어휘랑 — 용질·용매·용해)");
dropItem("sc6131", "v15", "주소가 v16(파리지옥)과 같음 — 제목 '식물들은 살아남기 위해…'에 맞는 영상을 알 수 없음");

// ── 결함 9: 표기
{
  const d = K("so5212");
  d.intro.core_question = d.intro.core_question.replace(/\s{2,}/g, " ");
  log.push(`표기 so5212 핵심 질문 이중 공백`); touched.add("so5212");
  const c = K("so4131").intro.concepts;
  if (c[3]?.term === "경제활동") { c[3] = { ...c[3], term: "선택" }; log.push(`용어 so4131: 두 번째 "경제활동" → "선택"(풀이가 선택을 설명)`); touched.add("so4131"); }
}

// ── 영상 점검(10/2, YouTube Data API) 반영
dropItem("so5213", "v10", "국내차단(한국에서 시청 불가)");
for (const d of by.values()) {
  for (const it of d.items as VideoItem[]) {
    if (it.embed === false && !it.status) { delete it.embed; log.push(`embed 해제 ${d.id}/${it.key} — 지금은 삽입 재생 가능(API 확인)`); touched.add(d.id); }
  }
}

for (const id of [...touched].sort()) writeFileSync(resolve(KITS_DIR, `${id}.yaml`), kitToYaml(K(id)));
console.log(log.join("\n"));
console.log(`\n✓ 꾸러미 ${touched.size}개 수정`);
