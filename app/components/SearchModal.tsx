import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import Modal from "./Modal.tsx";
import type { SearchResult, SearchResults } from "../lib/search.ts";

const EMPTY: SearchResults = { 단원: [], 영상: [], 성취기준: [], total: 0 };
const SCOPES: (keyof Omit<SearchResults, "total">)[] = ["단원", "영상", "성취기준"];
const SCOPE_BADGE: Record<string, { bg: string; color: string }> = {
  단원: { bg: "var(--color-brand-50)", color: "var(--color-brand-700)" },
  영상: { bg: "var(--color-warning-50)", color: "var(--color-warning-700)" },
  성취기준: { bg: "var(--color-success-50)", color: "var(--color-success-700)" },
};

export default function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  // search.ts(무거운 items 포함)는 모달 열 때 동적 로드 → 홈 번들에서 분리 유지
  const [fn, setFn] = useState<((q: string) => SearchResults) | null>(null);

  useEffect(() => {
    if (open) import("../lib/search.ts").then((m) => setFn(() => m.search));
    else setQ("");
  }, [open]);

  const res = useMemo(() => (fn && q.trim() ? fn(q) : EMPTY), [fn, q]);
  const sections = SCOPES.map((s) => ({ scope: s, items: res[s] })).filter((s) => s.items.length);

  function go(href: string) {
    onClose();
    navigate(`${href}?q=${encodeURIComponent(q.trim())}`); // ?q=로 검색어 전달 → 뷰어에서 하이라이트
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="search-title">
      <div style={{ position: "sticky", top: 0, zIndex: 1, background: "#fff", borderBottom: "1px solid var(--color-slate-100)", padding: "15px 18px", borderRadius: "18px 18px 0 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 4px" }}>
          <Search size={20} style={{ color: "var(--color-slate-400)", flexShrink: 0 }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} id="search-title" aria-label="검색"
            placeholder="검색어를 입력하세요"
            style={{ flex: 1, minWidth: 0, border: "none", outline: "none", fontSize: 16, fontWeight: 600, fontFamily: "var(--font-sans)", color: "var(--color-ink)", background: "transparent" }} />
          <button type="button" aria-label="닫기" onClick={onClose} style={{ width: 30, height: 30, flexShrink: 0, border: "none", borderRadius: 9999, background: "var(--color-slate-100)", color: "var(--color-slate-500)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={15} />
          </button>
        </div>
      </div>

      <div style={{ padding: "8px 12px 14px", minHeight: 120 }}>
        {!q.trim() ? null : res.total === 0 ? (
          <div style={{ textAlign: "center", padding: "36px 20px", fontSize: 13, fontWeight: 600, color: "var(--color-slate-400)" }}>
            {!fn ? "검색 준비 중…" : `"${q.trim()}"에 대한 결과가 없어요.`}
          </div>
        ) : (
          sections.map((sec, si) => (
            <div key={sec.scope}>
              {si > 0 && <div style={{ height: 1, background: "var(--color-slate-100)", margin: "12px 8px" }} />}
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px 8px" }}>
                <span style={{ padding: "4px 13px", borderRadius: 9999, fontSize: 14.5, fontWeight: 800, background: SCOPE_BADGE[sec.scope].bg, color: SCOPE_BADGE[sec.scope].color }}>{sec.scope}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-slate-400)" }}>{sec.items.length}</span>
              </div>
              {sec.items.map((r, i) => (
                <ResultRow key={i} r={r} onGo={go} />
              ))}
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}

function ResultRow({ r, onGo }: { r: SearchResult; onGo: (href: string) => void }) {
  return (
    <button type="button" onClick={() => onGo(r.href)} className="toc-item"
      style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 12px", border: "none", borderRadius: 10, cursor: "pointer", background: "transparent" }}>
      <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: "var(--color-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title}</span>
      {r.snippet && <span style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--color-slate-500)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.snippet}</span>}
      <span style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--color-slate-400)", marginTop: 3 }}>{r.crumb}</span>
    </button>
  );
}
