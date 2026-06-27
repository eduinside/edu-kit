// 에듀나비 단원 HTML(붙여넣기) → 구조화 파싱.
// 실행: npm run import:edunavi
// data/edunavi/*.html 을 읽어 단원 메타 + 콘텐츠 목록(cntntsSn·제목·핵심용어·설명·수업단계)을
// data/edunavi/<name>.parsed.json 으로 출력. 유튜브 URL은 별도 수집(로그인 필요) 후 병합.

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = resolve(ROOT, "data/edunavi");

const ent: Record<string, string> = { "&amp;": "&", "&nbsp;": " ", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };
function clean(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z#0-9]+;/gi, (m) => ent[m] ?? " ")
    .replace(/\s+/g, " ")
    .trim();
}

// 수업단계 태그 → edu-kit stage 추정 (편집자가 조정 가능)
const STAGE_BY_PLACEMENT: Record<string, string> = {
  배경지식: "생각열기",
  "수업 중": "탐구하기",
  수업중: "탐구하기",
  "수업 후": "확장하기",
  수업후: "확장하기",
};

interface ParsedItem {
  no: number;
  keyword: string;       // (지역문제) 등 핵심용어
  cntntsSn: string;      // 에듀나비 콘텐츠 번호 → 유튜브 매핑 키
  title: string;
  placement: string;     // 수업 중/배경지식/수업 후
  stage: string;         // 추정
  note: string;          // ⟹ 설명
  edunavi_url: string;
  video_url: string;     // (유튜브) 별도 수집 후 채움
}

function parseUnit(html: string) {
  const std = html.match(/\[([0-9]사[0-9]{2}-[0-9]{2})\]\s*([^<\n]+)/);
  const purposeM = html.match(/📖단원의 목적[\s\S]*?<\/p>\s*(?:<p[^>]*>(?:&nbsp;|\s|<br\s*\/?>)*<\/p>\s*)*<p[^>]*>([\s\S]*?)<\/p>/);
  const kwM = html.match(/🧭단원 핵심 용어[\s\S]*?<b[^>]*>([\s\S]*?)<\/b>/);
  const pkg = html.match(/packageSn=(\d+)/);

  const items: ParsedItem[] = [];
  const re = /(\d+)번\.\s*(?:<[^>]+>)*\(([^)]+)\)(?:<\/[^>]+>)*\s*<a\s+href="([^"]*cntntsSn=(\d+)[^"]*)"[^>]*>([\s\S]*?)<\/a>\s*<br\s*\/?>\s*⟹\s*(?:\(([^)]+)\))?\s*([\s\S]*?)<\/p>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const placement = (m[6] || "").trim();
    items.push({
      no: Number(m[1]),
      keyword: clean(m[2] || ""),
      cntntsSn: m[4]!,
      title: clean(m[5] || ""),
      placement,
      stage: STAGE_BY_PLACEMENT[placement.replace(/\s+/g, "")] ?? STAGE_BY_PLACEMENT[placement] ?? "탐구하기",
      note: clean(m[7] || ""),
      edunavi_url: clean(m[3] || ""),
      video_url: "",
    });
  }

  return {
    unit: {
      purpose: purposeM ? clean(purposeM[1]!) : "",
      standard_code: std ? `[${std[1]}]` : "",
      standard_text: std ? clean(std[2]!) : "",
      keywords: kwM ? clean(kwM[1]!).split(/[,，]/).map((s) => s.trim()).filter(Boolean) : [],
      packageSn: pkg ? pkg[1] : "",
    },
    items,
    cntntsSnNeedingVideo: items.map((i) => i.cntntsSn),
  };
}

// 성취기준 코드 → 학년·교과 추정
const SUBJECT_BY_CODE: Record<string, string> = { 사: "사회", 과: "과학", 국: "국어", 수: "수학" };
const STAGE_ORDER: Record<string, number> = { 단원안내: 1, 생각열기: 2, 탐구하기: 3, 확장하기: 4 };

// parsed + 유튜브맵 → kits/items/stage_meta 행(시트/ data/raw 형식)
function buildRows(parsed: ReturnType<typeof parseUnit>, yt: Record<string, string>) {
  const mc = parsed.unit.standard_code.match(/\[(\d)([가-힣])/);
  const grade = mc ? Number(mc[1]) : "";
  const subject = mc ? SUBJECT_BY_CODE[mc[2]!] ?? "" : "";
  const KIT = `na${parsed.unit.packageSn || "0"}`; // 임시 id(편집자가 변경 가능, kit/items 동일)

  const kits = [{
    id: KIT, title: "[단원 제목 입력]", grade, sem: "[학기]", subject,
    unit: "[대단원명 입력]", unit_no: "[번호]", flow: "activity", sort_order: 1, published: false,
  }];

  const items: Record<string, unknown>[] = [{
    kit_id: KIT, item_key: "intro", stage: "단원안내", type: "intro", sort_order: 1,
    title: "핵심 아이디어 · 성취기준", description: "이 단원에서 무엇을 배울까요",
    core_idea: parsed.unit.purpose,
    core_question: parsed.unit.keywords.length ? `${parsed.unit.keywords.join("·")}는 무엇이며 어떻게 살펴볼 수 있을까?` : "이 단원에서 무엇을 배울까?",
    concepts: parsed.unit.keywords.join(" ; "),
    standard_code: parsed.unit.standard_code, standard_text: parsed.unit.standard_text,
  }];

  const ord: Record<string, number> = {};
  for (const it of parsed.items) {
    const vid = yt[it.cntntsSn];
    const ok = vid && /^[A-Za-z0-9_-]{11}$/.test(vid);
    ord[it.stage] = (ord[it.stage] || 0) + 1;
    items.push({
      kit_id: KIT, item_key: `v${it.no}`, stage: it.stage, type: "video", sort_order: ord[it.stage],
      title: it.title, description: `(${it.keyword}) ${it.placement}`.trim(),
      video_url: ok ? `https://www.youtube.com/watch?v=${vid}` : `[유튜브 확인필요: cntntsSn ${it.cntntsSn}]`,
      video_title: it.title, video_desc: it.note,
    });
  }

  const stage_meta = [...new Set(parsed.items.map((i) => i.stage))]
    .map((s) => ({ kit_id: KIT, stage: s, question: "", sort_order: STAGE_ORDER[s] ?? 9 }));

  return { kits, items, stage_meta };
}

const files = readdirSync(DIR).filter((f) => f.endsWith(".html"));
if (!files.length) { console.log("data/edunavi/ 에 *.html 을 넣으세요."); process.exit(0); }

for (const f of files) {
  const html = readFileSync(resolve(DIR, f), "utf8");
  const parsed = parseUnit(html);
  const out = resolve(DIR, f.replace(/\.html$/, ".parsed.json"));
  writeFileSync(out, JSON.stringify(parsed, null, 2) + "\n");
  console.log(`✓ ${f}: 항목 ${parsed.items.length}개, 핵심용어 [${parsed.unit.keywords.join(", ")}], 성취 ${parsed.unit.standard_code}`);

  // 유튜브 맵이 있으면 꾸러미 행 생성
  const ytPath = resolve(DIR, f.replace(/\.html$/, ".youtube.json"));
  if (existsSync(ytPath)) {
    const yt = JSON.parse(readFileSync(ytPath, "utf8"));
    const rows = buildRows(parsed, yt);
    const rowsOut = resolve(DIR, f.replace(/\.html$/, ".rows.json"));
    writeFileSync(rowsOut, JSON.stringify(rows, null, 2) + "\n");
    const filled = rows.items.filter((i) => i.type === "video" && String(i.video_url).startsWith("http")).length;
    console.log(`  → ${f.replace(/\.html$/, ".rows.json")}: kits 1, items ${rows.items.length}(영상 ${filled}/${parsed.items.length} 유튜브), stage_meta ${rows.stage_meta.length}`);
  } else {
    console.log(`  유튜브 맵 없음 → ${f.replace(/\.html$/, ".youtube.json")} 만든 뒤 재실행(가이드: docs/EDUNAVI_HARVEST.md)`);
  }
}
