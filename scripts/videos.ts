// 영상 점검 — npm run videos   (운영자가 요청할 때 돌린다. 2개월 넘게 안 돌렸으면 한 번)
// 시트 시절 gas/video-check.gs와 같은 판정. 결과를 content/kits/*.yaml에 직접 적는다:
//   channel — 채널 이름(출처 표시용, 늘 기록)
//   status  — 문제 있을 때만(삭제·비공개 / 비공개 / 연령제한 / 국내차단 / 임베드차단 / URL오류). 정상이면 칸을 지운다.
// 실행 기록은 content/_ref/video-check.json(마지막 1회 + 문제 목록).
//
// 환경 변수 YT_API_KEY(YouTube Data API v3)가 있으면 API로 전부 판정한다.
// 없으면 oEmbed(키 불필요)로 임베드차단·삭제·채널만 본다 — 연령제한·국내차단은 못 잡는다.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import YAML from "yaml";
import { ROOT, KITS_DIR } from "./content.ts";
import { extractVideoId } from "./field-map.ts";

type Verdict = "정상" | "삭제·비공개" | "비공개" | "연령제한" | "국내차단" | "임베드차단" | "URL오류" | "점검실패";
interface Result { verdict: Verdict; channel?: string; detail?: string }

const REGION = "KR";
// 키는 저장소 밖에 둔다: edu-kit/.env(.gitignore 대상)에 YT_API_KEY=… 한 줄. 환경 변수가 있으면 그쪽이 먼저.
try { process.loadEnvFile(resolve(ROOT, ".env")); } catch { /* .env 없음 → oEmbed */ }
const KEY = process.env.YT_API_KEY?.trim();
const today = new Date().toISOString().slice(0, 10);

// ── 대상 모으기
const files = readdirSync(KITS_DIR).filter((f) => f.endsWith(".yaml")).sort();
const docs = files.map((f) => ({ f, doc: YAML.parseDocument(readFileSync(resolve(KITS_DIR, f), "utf8")) }));
const ids = new Set<string>();
for (const { doc } of docs) {
  for (const it of (doc.toJS().items ?? []) as { url: string }[]) {
    const v = extractVideoId(it.url);
    if (v) ids.add(v);
  }
}

// ── 판정
async function viaApi(all: string[]): Promise<Map<string, Result>> {
  const out = new Map<string, Result>();
  for (let i = 0; i < all.length; i += 50) {
    const chunk = all.slice(i, i + 50);
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,status,contentDetails&id=${chunk.join(",")}&key=${encodeURIComponent(KEY!)}`;
    const res = await fetch(url);
    if (!res.ok) { for (const id of chunk) out.set(id, { verdict: "점검실패", detail: `API ${res.status}` }); continue; }
    const body = (await res.json()) as { items?: any[] };
    const got = new Map((body.items ?? []).map((it) => [it.id as string, it]));
    for (const id of chunk) {
      const v = got.get(id);
      if (!v) { out.set(id, { verdict: "삭제·비공개", detail: "API 응답에 없음" }); continue; }
      const st = v.status ?? {}, cd = v.contentDetails ?? {}, channel = v.snippet?.channelTitle as string | undefined;
      const rr = cd.regionRestriction;
      let verdict: Verdict = "정상";
      if (st.privacyStatus === "private") verdict = "비공개";
      else if (st.uploadStatus === "rejected" || st.uploadStatus === "deleted") verdict = "삭제·비공개";
      else if (st.embeddable === false) verdict = "임베드차단";
      else if (cd.contentRating?.ytRating === "ytAgeRestricted") verdict = "연령제한";
      else if (rr && ((rr.blocked ?? []).includes(REGION) || (rr.allowed && !rr.allowed.includes(REGION)))) verdict = "국내차단";
      out.set(id, { verdict, channel });
    }
  }
  return out;
}

async function viaOembed(all: string[]): Promise<Map<string, Result>> {
  const out = new Map<string, Result>();
  let next = 0;
  async function worker() {
    while (next < all.length) {
      const id = all[next++];
      try {
        const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`);
        if (res.ok) out.set(id, { verdict: "정상", channel: ((await res.json()) as { author_name?: string }).author_name });
        else if (res.status === 401 || res.status === 403) out.set(id, { verdict: "임베드차단" });
        else if (res.status === 404 || res.status === 400) out.set(id, { verdict: "삭제·비공개", detail: `oEmbed ${res.status}` });
        else out.set(id, { verdict: "점검실패", detail: `oEmbed ${res.status}` });
      } catch (e) {
        out.set(id, { verdict: "점검실패", detail: (e as Error).message });
      }
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker));
  return out;
}

const started = Date.now();
const results = KEY ? await viaApi([...ids]) : await viaOembed([...ids]);

// ── YAML에 적기(바뀐 칸만)
let changedFiles = 0, changedItems = 0;
const problems: { kit: string; key: string; verdict: Verdict; url: string; detail?: string }[] = [];
for (const { f, doc } of docs) {
  const items = (doc.toJS().items ?? []) as { key: string; url: string; channel?: string; status?: string }[];
  let changed = false;
  items.forEach((it, i) => {
    const vid = extractVideoId(it.url);
    const r: Result = vid ? results.get(vid) ?? { verdict: "점검실패" } : { verdict: "URL오류" };
    if (r.verdict === "점검실패") { problems.push({ kit: f.replace(/\.yaml$/, ""), key: it.key, verdict: r.verdict, url: it.url, detail: r.detail }); return; }
    if (r.channel && r.channel !== it.channel) { doc.setIn(["items", i, "channel"], r.channel); changed = true; changedItems++; }
    const status = r.verdict === "정상" ? undefined : r.verdict;
    if (status !== it.status) {
      if (status) doc.setIn(["items", i, "status"], status);
      else doc.deleteIn(["items", i, "status"]);
      changed = true; changedItems++;
    }
    if (status) problems.push({ kit: f.replace(/\.yaml$/, ""), key: it.key, verdict: r.verdict, url: it.url, detail: r.detail });
  });
  if (changed) { writeFileSync(resolve(KITS_DIR, f), doc.toString({ lineWidth: 0, minContentWidth: 0 })); changedFiles++; }
}

const counts: Record<string, number> = {};
for (const p of problems) counts[p.verdict] = (counts[p.verdict] ?? 0) + 1;
const log = {
  date: today,
  mode: KEY ? "YouTube Data API" : "oEmbed(키 없음 — 연령제한·국내차단 판정 못 함)",
  videos: ids.size,
  problems: problems.length,
  counts,
  seconds: Math.round((Date.now() - started) / 1000),
  list: problems,
};
writeFileSync(resolve(ROOT, "content/_ref/video-check.json"), JSON.stringify(log, null, 1) + "\n");

console.log(`영상 점검 ${today} · ${log.mode}`);
console.log(`  고유 영상 ${ids.size} · 문제 ${problems.length} ${JSON.stringify(counts)} · ${log.seconds}초`);
console.log(`  바뀐 칸 ${changedItems} (파일 ${changedFiles}) → 결과는 npm run check, 목록은 content/_ref/video-check.json`);
