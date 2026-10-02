import { ensureVisitor, todayUTC, type D1DB } from "../../../_shared";

// POST /api/kits/:id/report — 영상 "문제 알리기". D1 edukit_reports에 쌓고, 비밀 값이 있으면 운영자에게 메일(Resend).
// 계획: docs/FEATURE_PLAN_report.md · 처리 절차: docs/OPERATIONS.md §3-7

interface ReportEnv {
  DB: D1DB;
  RESEND_API_KEY?: string;
  REPORT_EMAIL_TO?: string; // 쉼표로 여러 명
  REPORT_EMAIL_FROM?: string;
  REPORT_EMAIL_DAILY_CAP?: string;
}
interface ReportCtx {
  request: Request;
  env: ReportEnv;
  params: { id: string };
  waitUntil(p: Promise<unknown>): void;
}

const REASONS: Record<string, string> = {
  play: "영상이 재생되지 않아요",
  inappropriate: "수업에 알맞지 않은 내용이 있어요",
  other: "그 밖의 문제",
};
const PER_VISITOR_DAILY = 10;

const SCHEMA = `CREATE TABLE IF NOT EXISTS edukit_reports (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  kit_id      TEXT NOT NULL,
  item_key    TEXT NOT NULL,
  reason      TEXT NOT NULL,
  note        TEXT,
  item_title  TEXT,
  video_id    TEXT,
  visitor_id  TEXT NOT NULL,
  reported_on TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  emailed     INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'new',
  resolution  TEXT,
  UNIQUE (kit_id, item_key, reason, visitor_id, reported_on)
)`;
let schemaReady = false; // 같은 isolate에서는 한 번만

function reply(body: unknown, status: number, vid: string, isNew: boolean): Response {
  const headers: Record<string, string> = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
  if (isNew) headers["set-cookie"] = `ek_vid=${vid}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`;
  return new Response(JSON.stringify(body), { status, headers });
}

const clip = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, n) : "");
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export const onRequestPost = async (ctx: ReportCtx): Promise<Response> => {
  const { vid, isNew } = ensureVisitor(ctx.request);
  const kitId = ctx.params.id;
  let body: Record<string, unknown>;
  try { body = (await ctx.request.json()) as Record<string, unknown>; } catch { return reply({ error: "형식이 맞지 않아요" }, 400, vid, isNew); }

  // 스팸 봇이 채우는 숨은 칸 — 저장하지 않고 성공처럼 응답
  if (clip(body.website, 200)) return reply({ ok: true }, 200, vid, isNew);

  const item = clip(body.item, 20);
  const reason = clip(body.reason, 20);
  if (!/^[A-Za-z0-9]{3,8}$/.test(kitId) || !/^[A-Za-z0-9_]{1,20}$/.test(item) || !(reason in REASONS)) {
    return reply({ error: "형식이 맞지 않아요" }, 400, vid, isNew);
  }
  const note = clip(body.note, 300);
  const kitTitle = clip(body.kitTitle, 120);
  const itemTitle = clip(body.itemTitle, 200);
  const videoId = /^[A-Za-z0-9_-]{11}$/.test(clip(body.videoId, 11)) ? clip(body.videoId, 11) : "";
  const today = todayUTC();
  const db = ctx.env.DB;

  if (!schemaReady) { await db.prepare(SCHEMA).run(); schemaReady = true; }

  const mine = await db.prepare("SELECT COUNT(*) AS n FROM edukit_reports WHERE visitor_id=? AND reported_on=?").bind(vid, today).first<{ n: number }>();
  if ((mine?.n ?? 0) >= PER_VISITOR_DAILY) return reply({ error: "오늘은 더 보낼 수 없어요. 내일 다시 알려 주세요." }, 429, vid, isNew);

  const ins = await db
    .prepare("INSERT OR IGNORE INTO edukit_reports (kit_id, item_key, reason, note, item_title, video_id, visitor_id, reported_on) VALUES (?,?,?,?,?,?,?,?)")
    .bind(kitId, item, reason, note || null, itemTitle || null, videoId || null, vid, today)
    .run();
  if (ins.meta.changes === 0) return reply({ ok: true, duplicate: true }, 200, vid, isNew); // 오늘 이미 같은 신고

  const { RESEND_API_KEY: key, REPORT_EMAIL_TO: to } = ctx.env;
  if (key && to) ctx.waitUntil(notify(ctx.env, { rowId: ins.meta.last_row_id ?? 0, kitId, item, reason, note, kitTitle, itemTitle, videoId, today }).catch(() => {}));
  return reply({ ok: true }, 200, vid, isNew);
};

async function notify(env: ReportEnv, r: { rowId: number; kitId: string; item: string; reason: string; note: string; kitTitle: string; itemTitle: string; videoId: string; today: string }) {
  const cap = Math.max(1, Number(env.REPORT_EMAIL_DAILY_CAP) || 20);
  const sent = await env.DB.prepare("SELECT COUNT(*) AS n FROM edukit_reports WHERE reported_on=? AND emailed=1").bind(r.today).first<{ n: number }>();
  const n = sent?.n ?? 0;
  if (n >= cap) return; // 오늘 상한 — 저장만

  const kst = new Date(Date.now() + 9 * 3600e3).toISOString().replace("T", " ").slice(0, 16);
  const site = `https://kit.dgedu.link/${r.kitId}/${r.item}`;
  const yt = r.videoId ? `https://www.youtube.com/watch?v=${r.videoId}` : "";
  const last = n + 1 >= cap;
  const rows: [string, string][] = [
    ["단원", `${r.kitId} ${r.kitTitle}`.trim()],
    ["영상", `${r.item} ${r.itemTitle}`.trim()],
    ["이유", REASONS[r.reason]!],
    ["메모", r.note || "(없음)"],
    ["시각", `${kst} (KST)`],
  ];
  const text = [
    `[수업꾸러미] 영상 문제 알림`,
    ...rows.map(([k, v]) => `${k}: ${v}`),
    `사이트: ${site}`,
    yt && `유튜브: ${yt}`,
    ``,
    `처리: Claude에게 "수업꾸러미 신고 확인해 줘" (docs/OPERATIONS.md §3-7)`,
    last ? `※ 오늘 알림 메일 상한(${cap}통)에 닿았습니다. 이후 신고는 저장만 됩니다.` : "",
  ].filter(Boolean).join("\n");
  const html = `<div style="font-family:'Pretendard','맑은 고딕',sans-serif;color:#172B4D;max-width:520px">
<h2 style="font-size:17px;margin:0 0 12px">수업꾸러미 · 영상 문제 알림</h2>
<table style="border-collapse:collapse;font-size:14px;width:100%">${rows.map(([k, v]) => `<tr><td style="padding:6px 10px;background:#F4F5F7;width:64px;font-weight:700">${k}</td><td style="padding:6px 10px">${esc(v)}</td></tr>`).join("")}</table>
<p style="font-size:14px;margin:14px 0 4px"><a href="${site}">사이트에서 보기</a>${yt ? ` · <a href="${yt}">유튜브에서 보기</a>` : ""}</p>
<p style="font-size:12.5px;color:#626F86;margin:12px 0 0">처리: Claude에게 "수업꾸러미 신고 확인해 줘"${last ? `<br>※ 오늘 알림 메일 상한(${cap}통)에 닿았습니다. 이후 신고는 저장만 됩니다.` : ""}</p></div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: env.REPORT_EMAIL_FROM || "수업꾸러미 <kit-noreply@dgedu.link>",
      to: env.REPORT_EMAIL_TO!.split(",").map((s) => s.trim()).filter(Boolean),
      subject: `[수업꾸러미 신고] ${r.kitId}/${r.item} ${REASONS[r.reason]}`,
      text, html,
    }),
  });
  if (res.ok) {
    await env.DB.prepare("UPDATE edukit_reports SET emailed=1 WHERE id=?").bind(r.rowId).run();
  }
}
