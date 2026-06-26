import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Link2, Eye, Heart, Menu } from "lucide-react";
import Sidebar from "../components/viewer/Sidebar.tsx";
import ContentPane from "../components/viewer/ContentPane.tsx";
import { getKit, getGroups, flatItems } from "../lib/data.ts";
import { stageColor, flowLabel } from "../lib/design.ts";
import { statsFor } from "../lib/stats.ts";

export default function ViewerPage() {
  const { kitId = "", itemId } = useParams();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [liked, setLiked] = useState(false);
  const [copied, setCopied] = useState(false);

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

  const base = statsFor(kitId);
  const likes = base.likes + (liked ? 1 : 0);
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
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 34, padding: "0 12px", borderRadius: 9999, background: "var(--color-slate-50)", fontSize: 12, fontWeight: 700, color: "var(--color-slate-500)" }} aria-label={`조회수 ${base.views}회`}>
            <Eye size={14} /> {base.views}
          </span>
          <button type="button" onClick={() => setLiked((v) => !v)} aria-pressed={liked} aria-label="좋아요"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 34, padding: "0 13px", borderRadius: 9999, cursor: "pointer", fontSize: 12, fontWeight: 800, transition: "all .2s ease",
              border: `1px solid ${liked ? "var(--color-danger-100)" : "var(--color-slate-200)"}`, background: liked ? "var(--color-danger-50)" : "#fff", color: liked ? "var(--color-danger)" : "var(--color-slate-500)" }}>
            <span className={liked ? "sk-pop" : undefined} style={{ display: "inline-flex" }}>
              <Heart size={15} fill={liked ? "var(--color-danger)" : "none"} />
            </span>
            {likes}
          </button>
        </div>
      </div>

      {/* 본문 */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", position: "relative" }}>
        {sidebarOpen && sel && (
          <Sidebar groups={groups} selKey={sel.item.item_key} flowLabel={flowLabel(kit?.flow ?? "activity")}
            onSelect={(k) => navigate(`/${kitId}/${k}`)} onClose={() => setSidebarOpen(false)} />
        )}

        <div className="sk-scroll" style={{ flex: 1, minWidth: 0, overflowY: "auto", background: "var(--color-paper)" }}>
          {/* sticky 서브헤더 */}
          <div style={{ position: "sticky", top: 0, zIndex: 5, background: "rgba(243,245,249,.86)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", borderBottom: "1px solid var(--color-slate-100)", padding: "16px 32px" }}>
            <div style={{ maxWidth: 1080, margin: "0 auto" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
                {!sidebarOpen && (
                  <button type="button" className="icon-btn" onClick={() => setSidebarOpen(true)} aria-label="목차 펼치기" style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 28, padding: "0 11px", border: "1px solid var(--color-slate-200)", borderRadius: 9999, background: "#fff", cursor: "pointer", color: "var(--color-slate-600)", fontSize: 11.5, fontWeight: 700, flexShrink: 0 }}>
                    <Menu size={13} /> 목차
                  </button>
                )}
                {sel && (() => {
                  const st = stageColor(sel.group.stage);
                  return <span style={{ padding: "4px 11px", borderRadius: 9999, background: st.soft, color: st.text, fontSize: 11.5, fontWeight: 800 }}>{sel.group.stage}</span>;
                })()}
                {sel?.group.question && <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--color-slate-400)" }}>탐구질문 · {sel.group.question}</span>}
              </div>
              <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-.02em" }}>{sel ? sel.item.title : "준비 중"}</div>
            </div>
          </div>

          <div style={{ maxWidth: 1080, margin: "0 auto", padding: "26px 32px 80px" }}>
            <ContentPane item={sel?.item ?? null} stage={sel?.group.stage ?? "단원안내"} />
          </div>
        </div>
      </div>
    </div>
  );
}
