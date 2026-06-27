// 에듀나비 단원 HTML(붙여넣기) → 구조화 파싱.
// 실행: npm run import:edunavi
// data/edunavi/*.html 을 읽어 단원 메타 + 콘텐츠 목록(cntntsSn·제목·핵심용어·설명·수업단계)을
// data/edunavi/<name>.parsed.json 으로 출력. 유튜브 URL은 별도 수집(로그인 필요) 후 병합.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
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

const files = readdirSync(DIR).filter((f) => f.endsWith(".html"));
if (!files.length) { console.log("data/edunavi/ 에 *.html 을 넣으세요."); process.exit(0); }

for (const f of files) {
  const html = readFileSync(resolve(DIR, f), "utf8");
  const parsed = parseUnit(html);
  const out = resolve(DIR, f.replace(/\.html$/, ".parsed.json"));
  writeFileSync(out, JSON.stringify(parsed, null, 2) + "\n");
  console.log(`✓ ${f}: 항목 ${parsed.items.length}개, 핵심용어 [${parsed.unit.keywords.join(", ")}], 성취 ${parsed.unit.standard_code}`);
  console.log(`  cntntsSn(유튜브 필요): ${parsed.cntntsSnNeedingVideo.join(", ")}`);
}
