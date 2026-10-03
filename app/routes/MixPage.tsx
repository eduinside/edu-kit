import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Link2, Check, QrCode } from "lucide-react";
import ViewerShell from "../components/viewer/ViewerShell.tsx";
import Modal from "../components/Modal.tsx";
import { getKit, type Item, type Stage } from "../lib/data.ts";
import { ITEMS, type ViewerGroup } from "../lib/kit-content.ts";
import { getMix, mixQuery, parseMixQuery, qrSrc, type MixData } from "../lib/mix.ts";

// 모음 뷰어 — 교사가 고른 영상만, 고른 순서대로. 같은 단원에서 이어지는 영상끼리 단원 이름표로 묶는다.
// · /m?i=<kit>.<key>,…&t=<제목>[&n=<안내>][&v=<보는 영상>] — 주소에 담긴 모음(저장 없음, 2026-10-03~). 수업나래도 이 주소를 만든다.
// · /m/:mixId(/:itemId) — 10/2~10/3에 D1에 저장한 예전 모음.
// 모음 안의 항목 key는 "<kit>.<key>"(원래 꾸러미·key는 신고에 쓴다). 계획: docs/FEATURE_PLAN_mix.md
export default function MixPage() {
  const { mixId = "", itemId: pathItem } = useParams();
  const { search } = useLocation();
  const navigate = useNavigate();
  const queryMode = !mixId;
  const queryMix = useMemo(() => (queryMode ? parseMixQuery(search) : null), [queryMode, search]);
  const [stored, setStored] = useState<MixData | null | undefined>(undefined); // undefined = 불러오는 중, null = 없음
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  useEffect(() => {
    if (queryMode) return;
    let cancelled = false;
    setStored(undefined); setFailed(false);
    getMix(mixId).then((m) => { if (!cancelled) setStored(m); }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [queryMode, mixId]);

  const mix = queryMode ? queryMix : stored;
  const itemId = queryMode ? new URLSearchParams(search).get("v") ?? undefined : pathItem;

  // 모음 항목 → 뷰어 묶음. 꾸러미에서 빠진 영상은 건너뛴다.
  const { groups, origin } = useMemo(() => {
    const origin = new Map<string, { kitId: string; key: string }>();
    const groups: ViewerGroup[] = [];
    if (!mix) return { groups, origin };
    const byRef = new Map(ITEMS.filter((i) => i.type === "video").map((i) => [`${i.kit_id}/${i.item_key}`, i]));
    let n = 0;
    for (const r of mix.items) {
      const it = byRef.get(r);
      const kit = it && getKit(it.kit_id);
      if (!it || !kit) continue;
      const key = `${it.kit_id}.${it.item_key}`;
      origin.set(key, { kitId: it.kit_id, key: it.item_key });
      const item: Item = { ...it, item_key: key, id: `mix_${key}`, sort_order: ++n };
      const last = groups.at(-1);
      if (last && last.items[0]?.kit_id === it.kit_id) last.items.push(item);
      else groups.push({ stage: kit.title as Stage, question: null, sort_order: groups.length + 1, items: [item] });
    }
    return { groups, origin };
  }, [mix]);

  const count = groups.reduce((a, g) => a + g.items.length, 0);
  // 주소 모음은 보는 영상(v)만 뺀 지금 주소가 곧 모음 주소다
  const pageUrl = queryMode
    ? (() => { const q = new URLSearchParams(search); q.delete("v"); return `https://kit.dgedu.link/m?${mixQuery(q)}`; })()
    : `https://kit.dgedu.link/m/${mixId}`;
  const select = (k: string) => {
    if (!queryMode) return navigate(`/m/${mixId}/${k}`);
    const q = new URLSearchParams(search);
    q.set("v", k);
    navigate(`/m?${mixQuery(q)}`);
  };
  const shareUrl = mix?.shortUrl || pageUrl;

  function copyLink() {
    try { navigator.clipboard?.writeText(shareUrl); } catch { /* noop */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  const topRight = mix ? (
    <>
      <button type="button" className="icon-btn copy-btn" onClick={copyLink} aria-label="모음 링크 복사" style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 34, padding: "0 13px", border: "1px solid var(--color-slate-200)", borderRadius: 9999, background: "var(--color-slate-50)", cursor: "pointer", whiteSpace: "nowrap" }}>
        {copied ? <Check size={14} style={{ color: "var(--color-success-600, #059669)" }} /> : <Link2 size={13} style={{ color: "var(--color-slate-400)" }} />}
        <span className="copy-label" style={{ fontSize: 11.5, fontWeight: 800, color: copied ? "var(--color-success-700, #047857)" : "var(--color-brand-600)" }}>{copied ? "복사됨!" : "링크 복사"}</span>
      </button>
      <button type="button" className="icon-btn" onClick={() => setQrOpen(true)} aria-label="QR 보기" style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 34, padding: "0 12px", border: "1px solid var(--color-slate-200)", borderRadius: 9999, background: "#fff", cursor: "pointer", fontSize: 11.5, fontWeight: 800, color: "var(--color-slate-600)" }}>
        <QrCode size={14} /> QR
      </button>
    </>
  ) : null;

  const status = failed ? "모음을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요."
    : mix === undefined ? "모음을 불러오는 중…"
    : mix === null ? (queryMode ? "모음 주소가 올바르지 않아요." : "이 모음을 찾을 수 없어요.")
    : count === 0 ? "이 모음의 영상을 찾을 수 없어요."
    : undefined;

  return (
    <>
      <ViewerShell
        crumb={mix ? `수업꾸러미 모음 · 영상 ${count}개` : "수업꾸러미 모음"}
        title={mix?.title ?? "모음"}
        groups={groups}
        flowLabel="모음 순서"
        itemKey={itemId}
        onSelect={select}
        onBack={() => navigate("/")}
        docTitle={(head) => `${head ? head + " · " : ""}${mix?.title ?? "모음"} · 수업꾸러미`}
        topRight={topRight}
        sidebarNote={mix?.note ?? undefined}
        reportTarget={(item) => {
          const o = origin.get(item.item_key);
          const kit = o && getKit(o.kitId);
          return o && kit ? { kitId: o.kitId, kitTitle: kit.title, itemKey: o.key } : null;
        }}
        emptyMessage={status}
      />
      <Modal open={qrOpen} onClose={() => setQrOpen(false)} labelledBy="mix-qr-title" maxWidth={360}>
        <div style={{ padding: "22px 24px 24px", textAlign: "center" }}>
          <div id="mix-qr-title" style={{ fontSize: 16, fontWeight: 800, color: "var(--color-ink)" }}>{mix?.title}</div>
          <img src={qrSrc(mix, shareUrl)} alt="모음 QR 코드" width={220} height={220} style={{ margin: "16px auto 10px", display: "block" }} />
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-brand-600)", wordBreak: "break-all" }}>{shareUrl.replace(/^https:\/\//, "")}</div>
        </div>
      </Modal>
    </>
  );
}
