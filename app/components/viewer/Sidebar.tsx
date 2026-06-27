import { ChevronsLeft } from "lucide-react";
import type { ViewerGroup } from "../../lib/kit-content.ts";
import { stageColor, TYPE_BADGE } from "../../lib/design.ts";

interface Props {
  groups: ViewerGroup[];
  selKey: string;
  flowLabel: string;
  onSelect: (itemKey: string) => void;
  onClose: () => void;
}

export default function Sidebar({ groups, selKey, flowLabel, onSelect, onClose }: Props) {
  return (
    <nav className="sk-scroll" aria-label="학습 목차" style={{ width: 330, flexShrink: 0, height: "100%", minHeight: 0, background: "#fff", borderRight: "1px solid var(--color-slate-100)", overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain", padding: "14px 14px 40px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 8px 12px" }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: "var(--color-slate-400)", letterSpacing: ".06em" }}>{flowLabel}</span>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="목차 접기" style={{ display: "inline-flex", alignItems: "center", gap: 4, height: 26, padding: "0 9px", border: "1px solid var(--color-slate-200)", borderRadius: 9999, background: "#fff", cursor: "pointer", color: "var(--color-slate-500)", fontSize: 10.5, fontWeight: 700 }}>
          <ChevronsLeft size={13} /> 접기
        </button>
      </div>

      {groups.map((g) => {
        const st = stageColor(g.stage, g.sort_order);
        return (
          <div key={g.stage} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px" }}>
              <span style={{ padding: "4px 10px", borderRadius: 9999, background: st.soft, color: st.text, fontSize: 11, fontWeight: 800 }}>{g.stage}</span>
              <span style={{ height: 1, flex: 1, background: "var(--color-slate-100)" }} />
            </div>
            {g.question && (
              <div style={{ display: "flex", gap: 6, padding: "2px 10px 9px" }}>
                <span style={{ fontSize: 12, lineHeight: 1.2 }}>💡</span>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 600, lineHeight: 1.5, color: "var(--color-slate-500)" }}>{g.question}</p>
              </div>
            )}
            {g.items.map((it) => {
              const active = it.item_key === selKey;
              const badge = TYPE_BADGE[it.type];
              return (
                <button key={it.item_key} type="button" className="toc-item" aria-current={active ? "true" : undefined} onClick={() => onSelect(it.item_key)}
                  style={{ position: "relative", display: "flex", gap: 10, width: "100%", textAlign: "left", padding: "10px 11px", marginBottom: 2, border: "none", borderRadius: 10, cursor: "pointer", alignItems: "flex-start", background: active ? "var(--color-brand-50)" : "transparent" }}>
                  {active && <span style={{ position: "absolute", left: 0, top: 8, bottom: 8, width: 3, borderRadius: "0 3px 3px 0", background: "var(--color-brand-500)" }} />}
                  <span style={{ position: "relative", flexShrink: 0, padding: "3px 7px", borderRadius: 6, fontSize: 9.5, fontWeight: 800, background: badge.soft, color: badge.text }}>{badge.label}</span>
                  <span style={{ position: "relative", minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--color-ink)", lineHeight: 1.35 }}>{it.title}</span>
                    {it.description && <span style={{ display: "block", fontSize: 11, fontWeight: 500, color: "var(--color-slate-400)", marginTop: 2, lineHeight: 1.4 }}>{it.description}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
