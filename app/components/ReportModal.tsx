import { useEffect, useState, type CSSProperties } from "react";
import { Flag } from "lucide-react";
import Modal from "./Modal.tsx";
import { postReport, type ReportReason } from "../lib/api.ts";

// 영상 "문제 알리기" 창 — 이유 하나 + 메모(선택). 서버가 D1에 쌓고 운영자에게 메일로 알린다(docs/FEATURE_PLAN_report.md).
const REASONS: { value: ReportReason; label: string }[] = [
  { value: "play", label: "영상이 재생되지 않아요" },
  { value: "inappropriate", label: "수업에 알맞지 않은 내용이 있어요" },
  { value: "other", label: "그 밖의 문제" },
];

export default function ReportModal({ open, onClose, kitId, kitTitle, item }: {
  open: boolean;
  onClose: () => void;
  kitId: string;
  kitTitle: string;
  item: { item_key: string; title: string; video_id?: string };
}) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const [trap, setTrap] = useState(""); // 사람에게는 안 보이는 칸(스팸 봇 거르기)
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");

  // 다른 영상에서 다시 열면 처음부터
  useEffect(() => { if (open) { setReason(null); setNote(""); setState("idle"); setError(""); } }, [open, item.item_key]);

  async function send() {
    if (!reason) return;
    setState("sending");
    try {
      await postReport(kitId, { item: item.item_key, reason, note: note.trim() || undefined, kitTitle, itemTitle: item.title, videoId: item.video_id, website: trap || undefined });
      setState("done");
    } catch (e) {
      setError((e as Error).message);
      setState("error");
    }
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="report-title" maxWidth={440}>
      <div style={{ padding: "22px 24px 24px" }}>
        <div id="report-title" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 17, fontWeight: 800, color: "var(--color-ink)" }}>
          <Flag size={17} /> 문제 알리기
        </div>
        <p style={{ margin: "5px 0 14px", fontSize: 12.5, fontWeight: 500, color: "var(--color-slate-500)", lineHeight: 1.55 }}>
          「{item.title}」 영상에 문제가 있나요? 알려 주시면 운영자가 확인할게요.
        </p>

        {state === "done" ? (
          <div style={{ textAlign: "center", padding: "22px 10px 6px" }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>🙏</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "var(--color-slate-700)" }}>알려 주셔서 고맙습니다.</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-slate-500)", marginTop: 4 }}>운영자가 확인할게요.</div>
            <button type="button" onClick={onClose} style={{ ...btn(true), marginTop: 16 }}>닫기</button>
          </div>
        ) : (
          <>
            <div role="radiogroup" aria-label="문제 종류" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {REASONS.map((r) => (
                <label key={r.value} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 13px", borderRadius: 11, cursor: "pointer", border: `1.5px solid ${reason === r.value ? "var(--color-brand-500, #2563eb)" : "var(--color-slate-100)"}`, background: reason === r.value ? "var(--color-brand-50, #eff6ff)" : "#fff", fontSize: 14, fontWeight: 700, color: "var(--color-slate-700)" }}>
                  <input type="radio" name="report-reason" value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} />
                  {r.label}
                </label>
              ))}
            </div>
            <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 300))} rows={3} placeholder="더 알려 줄 내용이 있으면 적어 주세요(선택)"
              aria-label="메모(선택)"
              style={{ width: "100%", boxSizing: "border-box", marginTop: 12, padding: "10px 12px", borderRadius: 11, border: "1px solid var(--color-slate-200)", fontSize: 13.5, fontFamily: "inherit", resize: "vertical" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, fontWeight: 500, color: "var(--color-slate-400)", marginTop: 4 }}>
              <span>이름·연락처는 적지 마세요.</span><span>{note.length}/300</span>
            </div>
            <input type="text" tabIndex={-1} autoComplete="off" aria-hidden value={trap} onChange={(e) => setTrap(e.target.value)}
              style={{ position: "absolute", left: -9999, width: 1, height: 1, opacity: 0 }} name="website" />
            {state === "error" && <div role="alert" style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: "var(--color-danger, #dc2626)" }}>{error}</div>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
              <button type="button" onClick={onClose} style={btn(false)}>취소</button>
              <button type="button" onClick={send} disabled={!reason || state === "sending"} style={{ ...btn(true), opacity: !reason || state === "sending" ? 0.5 : 1 }}>
                {state === "sending" ? "보내는 중…" : "보내기"}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function btn(primary: boolean): CSSProperties {
  return {
    padding: "9px 18px", borderRadius: 999, fontSize: 13.5, fontWeight: 800, cursor: "pointer",
    border: primary ? "none" : "1px solid var(--color-slate-200)",
    background: primary ? "var(--color-ink, #0f172a)" : "#fff",
    color: primary ? "#fff" : "var(--color-slate-600)",
  };
}
