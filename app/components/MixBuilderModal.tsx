import { useState } from "react";
import { ArrowUp, ArrowDown, X, Link2, Check, ExternalLink, Layers } from "lucide-react";
import Modal from "./Modal.tsx";
import { getKit } from "../lib/data.ts";
import { ITEMS } from "../lib/kit-content.ts";
import { useBasket, setBasket, mixUrl, shortenMix, qrSrc, MAX_MIX, type Shortened } from "../lib/mix.ts";

// 모음 만들기 창 — 담은 영상 순서 바꾸기·빼기 + 제목·안내 → 모음 주소(?i=, 저장 없음) + 짧은 주소·QR. 무거운 영상 목록을 쓰므로 지연 로드.
export default function MixBuilderModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const basket = useBasket();
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "error">("idle");
  const [error, setError] = useState("");
  const [made, setMade] = useState<Shortened | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const byRef = new Map(ITEMS.filter((i) => i.type === "video").map((i) => [`${i.kit_id}/${i.item_key}`, i]));
  const rows = basket.map((r) => ({ r, it: byRef.get(r) }));

  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= basket.length) return;
    const next = [...basket];
    [next[i], next[j]] = [next[j]!, next[i]!];
    setBasket(next);
  };

  async function make() {
    setState("sending");
    try {
      const items = rows.filter((x) => x.it).map((x) => x.r);
      setMade(await shortenMix(mixUrl({ title: title.trim(), note: note.trim() || undefined, items }), title.trim()));
      setState("idle");
    } catch (e) {
      setError((e as Error).message);
      setState("error");
    }
  }

  function copy(text: string) {
    try { navigator.clipboard?.writeText(text); } catch { /* noop */ }
    setCopied(text);
    setTimeout(() => setCopied(null), 1600);
  }

  function close() {
    onClose();
    if (made) { setMade(null); setTitle(""); setNote(""); }
  }

  const canMake = title.trim().length > 0 && rows.some((x) => x.it) && state !== "sending";
  const needTitle = !title.trim() && rows.some((x) => x.it); // 담은 영상은 있는데 제목이 비었을 때만 알린다

  return (
    <Modal open={open} onClose={close} labelledBy="mix-title" maxWidth={560}>
      <div style={{ padding: "22px 24px 24px" }}>
        <div id="mix-title" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 17, fontWeight: 800, color: "var(--color-ink)" }}>
          <Layers size={18} /> {made ? "모음 주소가 만들어졌어요" : "모음 만들기"}
        </div>

        {made ? (
          <div style={{ marginTop: 14 }}>
            <p style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 500, color: "var(--color-slate-500)", lineHeight: 1.6 }}>
              이 주소 하나를 PPT·학급 게시판·패들렛에 붙이거나 교실 화면에서 여세요. 담은 순서대로 영상이 나와요.
            </p>
            <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
              <img src={qrSrc(made, made.shortUrl || made.url)} alt="모음 QR 코드" width={150} height={150} style={{ borderRadius: 8, border: "1px solid var(--color-slate-100)" }} />
              <div style={{ flex: 1, minWidth: 220, display: "flex", flexDirection: "column", gap: 8 }}>
                {[made.shortUrl, made.url].filter((u): u is string => !!u).map((u) => (
                  <div key={u} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 11, border: "1px solid var(--color-slate-100)", background: "var(--color-slate-50)" }}>
                    <span style={{ flex: 1, minWidth: 0, fontSize: u === made.shortUrl ? 15 : 12.5, fontWeight: 800, color: "var(--color-brand-600)", wordBreak: "break-all" }}>{shown(u)}</span>
                    <button type="button" onClick={() => copy(u)} aria-label="주소 복사" style={iconBtn}>{copied === u ? <Check size={14} /> : <Link2 size={14} />}</button>
                  </div>
                ))}
                {!made.shortUrl && (
                  <div role="status" style={{ fontSize: 12, fontWeight: 600, color: "var(--color-slate-500)", lineHeight: 1.5 }}>
                    짧은 주소를 만들지 못했어요. 위 주소를 그대로 써도 같은 모음이 열려요.
                  </div>
                )}
                <a href={made.url.replace(/^https:\/\/kit\.dgedu\.link/, "")} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "var(--color-slate-600)" }}>
                  <ExternalLink size={13} /> 모음 열어 보기
                </a>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
              <button type="button" onClick={() => { setBasket([]); close(); }} style={btn(false)}>담은 목록 비우기</button>
              <button type="button" onClick={close} style={btn(true)}>닫기</button>
            </div>
          </div>
        ) : (
          <>
            <p style={{ margin: "5px 0 14px", fontSize: 12.5, fontWeight: 500, color: "var(--color-slate-500)", lineHeight: 1.55 }}>
              수업에 쓸 영상을 순서대로 모아 주소 하나로 만들어요. ({basket.length}/{MAX_MIX})
            </p>
            {rows.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px 10px", fontSize: 13.5, fontWeight: 700, color: "var(--color-slate-500)" }}>
                아직 담은 영상이 없어요. 영상 화면의 「＋ 모음에 담기」를 눌러 보세요.
              </div>
            ) : (
              <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6, maxHeight: "36vh", overflowY: "auto" }}>
                {rows.map(({ r, it }, i) => {
                  const kit = it && getKit(it.kit_id);
                  return (
                    <li key={r} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 11, border: "1px solid var(--color-slate-100)", background: "#fff", opacity: it ? 1 : 0.55 }}>
                      <span style={{ width: 20, textAlign: "right", fontSize: 12, fontWeight: 800, color: "var(--color-slate-400)" }}>{i + 1}</span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: "var(--color-slate-400)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{kit ? `${kit.grade}학년 ${kit.subject} · ${kit.title}` : "꾸러미에서 빠진 영상"}</span>
                        <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: "var(--color-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it?.title ?? r}</span>
                      </span>
                      <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="위로" style={iconBtn}><ArrowUp size={14} /></button>
                      <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label="아래로" style={iconBtn}><ArrowDown size={14} /></button>
                      <button type="button" onClick={() => setBasket(basket.filter((x) => x !== r))} aria-label="빼기" style={iconBtn}><X size={14} /></button>
                    </li>
                  );
                })}
              </ol>
            )}
            <label htmlFor="mix-title-input" style={{ display: "block", marginTop: 14, marginBottom: 6, fontSize: 12.5, fontWeight: 800, color: "var(--color-slate-600)" }}>
              모음 제목 <span style={{ color: "var(--color-danger, #dc2626)" }}>*필수</span>
            </label>
            <input id="mix-title-input" value={title} onChange={(e) => setTitle(e.target.value.slice(0, 60))} placeholder="예: 4학년 우리 지역의 옛날과 오늘" aria-required="true" aria-describedby="mix-title-hint"
              style={{ ...field, ...(needTitle ? { border: "1px solid var(--color-warning-400, #f59e0b)" } : {}) }} />
            {needTitle && (
              <div id="mix-title-hint" role="status" style={{ marginTop: 6, fontSize: 12.5, fontWeight: 700, color: "var(--color-warning-700, #b45309)" }}>
                제목을 적어야 모음 주소를 만들 수 있어요. 제목은 모음 화면 맨 위와 링크 미리보기에 보여요.
              </div>
            )}
            <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 300))} rows={2} placeholder="안내 글(선택) — 모음 화면 목차 위에 보여요" aria-label="안내 글(선택)"
              style={{ ...field, marginTop: 8, resize: "vertical" }} />
            {state === "error" && <div role="alert" style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: "var(--color-danger, #dc2626)" }}>{error}</div>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
              <button type="button" onClick={close} style={btn(false)}>닫기</button>
              <button type="button" onClick={make} disabled={!canMake} style={{ ...btn(true), opacity: canMake ? 1 : 0.5 }}>
                {state === "sending" ? "만드는 중…" : "모음 주소 만들기"}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

// 보여 줄 때만 한글을 풀어 쓴다(복사는 인코딩된 주소 그대로 — 메신저·게시판에서 깨지지 않게)
function shown(u: string): string {
  const s = u.replace(/^https:\/\//, "");
  try { return decodeURIComponent(s.replace(/\+/g, " ")); } catch { return s; }
}

const iconBtn = { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 8, border: "1px solid var(--color-slate-200)", background: "#fff", color: "var(--color-slate-500)", cursor: "pointer", flexShrink: 0 } as const;
const field = { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 11, border: "1px solid var(--color-slate-200)", fontSize: 14, fontFamily: "inherit" } as const;
function btn(primary: boolean) {
  return {
    padding: "9px 18px", borderRadius: 999, fontSize: 13.5, fontWeight: 800, cursor: "pointer",
    border: primary ? "none" : "1px solid var(--color-slate-200)",
    background: primary ? "var(--color-ink, #0f172a)" : "#fff",
    color: primary ? "#fff" : "var(--color-slate-600)",
  } as const;
}
