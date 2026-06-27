import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Link2, Eye, Heart, Menu } from "lucide-react";

const NARROW_Q = "(max-width: 860px)";
import Sidebar from "../components/viewer/Sidebar.tsx";
import ContentPane from "../components/viewer/ContentPane.tsx";
import { getKit, getGroups, flatItems } from "../lib/data.ts";
import type { Item } from "../lib/data.ts";
import { stageColor, flowLabel } from "../lib/design.ts";
import { statsFor } from "../lib/stats.ts";
import { postView, postLike, type Stats } from "../lib/api.ts";

export default function ViewerPage() {
  const { kitId = "", itemId } = useParams();
  const navigate = useNavigate();
  const initialNarrow = typeof window !== "undefined" && window.matchMedia(NARROW_Q).matches;
  const [isNarrow, setIsNarrow] = useState(initialNarrow);
  const [sidebarOpen, setSidebarOpen] = useState(!initialNarrow); // 모바일/탭에선 기본 숨김
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState<Stats>(() => ({ ...statsFor(kitId), liked: false }));

  // 화면 폭 변화 → 좁으면 사이드바 숨김(오버레이), 넓으면 표시
  useEffect(() => {
    const mq = window.matchMedia(NARROW_Q);
    const on = () => { setIsNarrow(mq.matches); setSidebarOpen(!mq.matches); };
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  function selectItem(k: string) {
    navigate(`/${kitId}/${k}`);
    if (isNarrow) setSidebarOpen(false); // 모바일: 선택 후 목차 닫기
  }

  // 진입 시 조회수 집계 + 라이브 stats 수신. Functions 미가동(dev)이면 시드 유지.
  useEffect(() => {
    setStats({ ...statsFor(kitId), liked: false });
    let cancelled = false;
    postView(kitId).then((s) => { if (!cancelled) setStats(s); }).catch(() => { /* 시드 폴백 */ });
    return () => { cancelled = true; };
  }, [kitId]);

  async function toggleLike() {
    const next = !stats.liked;
    const prev = stats;
    setStats({ ...stats, liked: next, likes: Math.max(0, stats.likes + (next ? 1 : -1)) }); // 낙관적
    try { setStats(await postLike(kitId, next)); } catch { setStats(prev); } // 실패 시 롤백
  }

  const kit = getKit(kitId);
  const groups = getGroups(kitId);
  const flat = flatItems(groups);
  const selKey = itemId || flat[0]?.item_key || "";

  let sel: { group: (typeof groups)[number]; item: (typeof flat)[number] } | null = null;
  for (const g of groups) {
    const it = g.items.find((i) => i.item_key === selKey);
    if (it) { sel = { group: g, item: it }; break; }
  }
  if (!sel && groups[0]?.items[0]) sel = { group: groups[0], item: groups[0].items[0] };

  const curIdx = flat.findIndex((i) => i.item_key === (sel?.item.item_key ?? selKey));
  const prevItem = curIdx > 0 ? flat[curIdx - 1] : null;
  const nextItem = curIdx >= 0 && curIdx < flat.length - 1 ? flat[curIdx + 1] : null;

  const crumb = kit ? `초등 ${kit.grade}학년 · ${kit.sem} · ${kit.subject}` : "";

  function copyLink() {
    try { navigator.clipboard?.writeText(`https://kit.dgedu.link/${kitId}`); } catch { /* noop */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "var(--color-paper)", display: "flex", flexDirection: "column", fontFamily: "var(--font-sans)", color: "var(--color-ink)" }}>
      {/* 상단 바 */}
      <div style={{ height: 60, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "0 18px", background: "#fff", borderBottom: "1px solid var(--color-slate-100)", boxShadow: "0 1px 1px rgba(15,23,42,.04)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
          <button type="button" className="icon-btn" aria-label="목록으로" onClick={() => navigate("/")} style={{ width: 36, height: 36, flexShrink: 0, border: "1px solid var(--color-slate-200)", borderRadius: 9999, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-slate-600)", cursor: "pointer" }}>
            <ChevronLeft size={17} />
          </button>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-slate-400)" }}>{crumb}</div>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{kit ? kit.title : "수업꾸러미"}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 9, flexShrink: 0 }}>
          <button type="button" className="icon-btn" onClick={copyLink} style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 34, padding: "0 13px", border: "1px solid var(--color-slate-200)", borderRadius: 9999, background: "var(--color-slate-50)", cursor: "pointer", whiteSpace: "nowrap" }}>
            <Link2 size={13} style={{ color: "var(--color-slate-400)" }} />
            <span style={{ fontSize: 11.5, fontWeight: 800, color: "var(--color-brand-600)" }}>{copied ? "복사됨!" : "링크 복사"}</span>
          </button>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 34, padding: "0 12px", borderRadius: 9999, background: "var(--color-slate-50)", fontSize: 12, fontWeight: 700, color: "var(--color-slate-500)" }} aria-label={`조회수 ${stats.views}회`}>
            <Eye size={14} /> {stats.views}
          </span>
          <button type="button" onClick={toggleLike} aria-pressed={stats.liked} aria-label="좋아요"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 34, padding: "0 13px", borderRadius: 9999, cursor: "pointer", fontSize: 12, fontWeight: 800, transition: "all .2s ease",
              border: `1px solid ${stats.liked ? "var(--color-danger-100)" : "var(--color-slate-200)"}`, background: stats.liked ? "var(--color-danger-50)" : "#fff", color: stats.liked ? "var(--color-danger)" : "var(--color-slate-500)" }}>
            <span className={stats.liked ? "sk-pop" : undefined} style={{ display: "inline-flex" }}>
              <Heart size={15} fill={stats.liked ? "var(--color-danger)" : "none"} />
            </span>
            {stats.likes}
          </button>
        </div>
      </div>

      {/* 본문 */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", position: "relative" }}>
        {sidebarOpen && sel && isNarrow && (
          // 모바일/탭: 오버레이 + scrim (본문을 밀지 않음)
          <div onClick={() => setSidebarOpen(false)} style={{ position: "absolute", inset: 0, zIndex: 20, background: "rgba(15,23,42,.4)" }} />
        )}
        {sidebarOpen && sel && (
          <div style={isNarrow
            ? { position: "absolute", left: 0, top: 0, bottom: 0, zIndex: 21, boxShadow: "4px 0 24px rgba(15,23,42,.18)" }
            : { display: "contents" }}>
            <Sidebar groups={groups} selKey={sel.item.item_key} flowLabel={flowLabel(kit?.flow ?? "activity")}
              onSelect={selectItem} onClose={() => setSidebarOpen(false)} />
          </div>
        )}

        <div className="sk-scroll" style={{ flex: 1, minWidth: 0, overflowY: "auto", background: "var(--color-paper)" }}>
          {/* sticky 서브헤더 */}
          <div style={{ position: "sticky", top: 0, zIndex: 5, background: "rgba(243,245,249,.86)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", borderBottom: "1px solid var(--color-slate-100)", padding: "16px 24px" }}>
            <div style={{ maxWidth: 1280, margin: "0 auto" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
                {!sidebarOpen && (
                  <button type="button" className="icon-btn" onClick={() => setSidebarOpen(true)} aria-label="목차 펼치기" style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 28, padding: "0 11px", border: "1px solid var(--color-slate-200)", borderRadius: 9999, background: "#fff", cursor: "pointer", color: "var(--color-slate-600)", fontSize: 11.5, fontWeight: 700, flexShrink: 0 }}>
                    <Menu size={13} /> 목차
                  </button>
                )}
                {sel && (() => {
                  const st = stageColor(sel.group.stage, sel.group.sort_order);
                  return <span style={{ padding: "4px 11px", borderRadius: 9999, background: st.soft, color: st.text, fontSize: 11.5, fontWeight: 800 }}>{sel.group.stage}</span>;
                })()}
                {sel?.group.question && <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--color-slate-400)" }}>탐구질문 · {sel.group.question}</span>}
              </div>
              <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-.02em" }}>{sel ? sel.item.title : "준비 중"}</div>
            </div>
          </div>

          <div style={{ maxWidth: 1280, margin: "0 auto", padding: "26px 24px 80px" }}>
            <ContentPane item={sel?.item ?? null} stage={sel?.group.stage ?? "단원안내"} />
            {sel && (prevItem || nextItem) && (
              <div style={{ display: "flex", gap: 12, marginTop: 28 }}>
                <NavButton dir="prev" item={prevItem} onSelect={selectItem} />
                <NavButton dir="next" item={nextItem} onSelect={selectItem} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function NavButton({ dir, item, onSelect }: { dir: "prev" | "next"; item: Item | null; onSelect: (k: string) => void }) {
  const isPrev = dir === "prev";
  const enabled = !!item;
  return (
    <button
      type="button"
      disabled={!enabled}
      onClick={() => item && onSelect(item.item_key)}
      style={{
        flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 10,
        justifyContent: isPrev ? "flex-start" : "flex-end",
        padding: "13px 16px", borderRadius: 14,
        border: "1px solid var(--color-slate-100)",
        background: enabled ? "#fff" : "transparent",
        boxShadow: enabled ? "0 1px 2px rgba(15,23,42,.06)" : "none",
        cursor: enabled ? "pointer" : "default", opacity: enabled ? 1 : 0.55,
        transition: "box-shadow .15s ease, border-color .15s ease",
      }}
    >
      {isPrev && <ChevronLeft size={18} style={{ color: "var(--color-slate-400)", flexShrink: 0 }} />}
      <span style={{ minWidth: 0, textAlign: isPrev ? "left" : "right" }}>
        <span style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--color-slate-400)" }}>{isPrev ? "이전" : "다음"}</span>
        <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: "var(--color-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {item ? item.title : isPrev ? "처음입니다" : "마지막입니다"}
        </span>
      </span>
      {!isPrev && <ChevronRight size={18} style={{ color: "var(--color-slate-400)", flexShrink: 0 }} />}
    </button>
  );
}
