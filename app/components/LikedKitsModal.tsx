import { Heart, ChevronRight } from "lucide-react";
import Modal from "./Modal.tsx";
import { getKit, type Kit } from "../lib/data.ts";

// 이 브라우저가 좋아요한 단원 목록 모달. 항목 클릭 → 해당 단원으로 이동.
export default function LikedKitsModal({
  open, onClose, ids, onSelect,
}: { open: boolean; onClose: () => void; ids: string[]; onSelect: (id: string) => void }) {
  const kits = ids.map(getKit).filter((k): k is Kit => !!k); // 사라진 id는 제외

  return (
    <Modal open={open} onClose={onClose} labelledBy="liked-title">
      <div style={{ padding: "22px 24px 24px" }}>
        <div id="liked-title" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 17, fontWeight: 800, color: "var(--color-ink)" }}>
          <Heart size={18} fill="var(--color-danger)" color="var(--color-danger)" /> 좋아요한 단원
        </div>
        <p style={{ margin: "5px 0 16px", fontSize: 12.5, fontWeight: 500, color: "var(--color-slate-500)" }}>이 브라우저에서 좋아요를 누른 단원이에요.</p>

        {kits.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>🤍</div>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: "var(--color-slate-600)" }}>아직 좋아요한 단원이 없어요</div>
            <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--color-slate-400)", marginTop: 5 }}>단원을 열고 하트(♥)를 눌러 보세요.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {kits.map((k) => (
              <button key={k.id} type="button" className="liked-row" onClick={() => onSelect(k.id)}
                style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", padding: "12px 14px", border: "1px solid var(--color-slate-100)", borderRadius: 12, background: "#fff", cursor: "pointer" }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-slate-400)" }}>초등 {k.grade}학년 · {k.sem} · {k.subject} · {k.unit}</div>
                  <div style={{ fontSize: 14.5, fontWeight: 800, color: "var(--color-ink)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{k.title}</div>
                </div>
                <ChevronRight size={18} style={{ color: "var(--color-slate-300)", flexShrink: 0 }} />
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
