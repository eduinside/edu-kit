import { Landmark, FlaskConical, Eye, Heart } from "lucide-react";
import type { Kit } from "../lib/data.ts";
import { kitPalette, thumbStyle } from "../lib/design.ts";
import { statsFor } from "../lib/stats.ts";

export default function KitCard({ kit, onOpen }: { kit: Kit; onOpen: () => void }) {
  const accent = kitPalette(kit.subject, kit.sort_order)[2];
  const Icon = kit.subject === "과학" ? FlaskConical : Landmark;
  const s = statsFor(kit.id);

  return (
    <div
      className="kit-card sk-rise"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      style={{
        cursor: "pointer",
        background: "#fff",
        border: "1px solid var(--color-slate-100)",
        borderRadius: 14,
        boxShadow: "0 1px 2px rgba(15,23,42,.06)",
        overflow: "hidden",
      }}
    >
      <div style={thumbStyle(kit.subject, kit.sort_order)}>
        <div style={{ position: "absolute", top: 12, left: 12, display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 9px", borderRadius: 9999, background: "rgba(255,255,255,.82)" }}>
          <Icon size={11} color={accent} strokeWidth={2.2} />
          <span style={{ fontSize: 10, fontWeight: 800, color: accent }}>{kit.subject} · {kit.unit_no}단원</span>
        </div>
        <div style={{ position: "absolute", right: -8, bottom: -14, opacity: 0.16 }}>
          <Icon size={150} color={accent} strokeWidth={1} />
        </div>
        <div style={{ position: "absolute", left: 14, right: 14, bottom: 13 }}>
          <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1.25, color: accent }}>{kit.title}</div>
        </div>
        {!kit.published && (
          <div style={{ position: "absolute", top: 12, right: 12, padding: "4px 8px", borderRadius: 9999, background: "rgba(255,255,255,.85)", fontSize: 9, fontWeight: 800, color: "var(--color-slate-500)" }}>준비 중</div>
        )}
        {kit.published && kit.flow === "flow" && (
          <div style={{ position: "absolute", top: 12, right: 12, padding: "4px 8px", borderRadius: 9999, background: "rgba(255,255,255,.9)", fontSize: 9, fontWeight: 800, color: "var(--color-brand-700)" }}>⚡ 핵심용어 흐름</div>
        )}
      </div>
      <div style={{ padding: "13px 15px 14px" }}>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--color-slate-400)", lineHeight: 1.4 }}>{kit.unit}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 13, marginTop: 11, paddingTop: 11, borderTop: "1px solid var(--color-slate-100)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: "var(--color-slate-500)" }}><Eye size={14} /> {s.views}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: "var(--color-slate-500)" }}><Heart size={13} /> {s.likes}</span>
        </div>
      </div>
    </div>
  );
}
