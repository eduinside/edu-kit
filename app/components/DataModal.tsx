import { X } from "lucide-react";
import Modal from "./Modal.tsx";

const KIT_COLS: [string, string, string][] = [
  ["id (shortId)", "string", "짧은 링크 키 — kit.dgedu.link/ab12"],
  ["title", "string", "단원(꾸러미) 제목 · 썸네일 자동 표기"],
  ["grade / sem", "string", "학년 · 학기"],
  ["subject", "enum", "사회 · 과학 (썸네일 색·아이콘 결정)"],
  ["unit", "string", "대단원 분류 — 칩 필터 기준"],
  ["flow", "enum", "activity(활동형) · flow(핵심용어 흐름형)"],
  ["published", "bool", "공개 여부"],
];
const ITEM_COLS: [string, string, string][] = [
  ["kit_id", "string", "소속 꾸러미(kits.id)"],
  ["stage", "enum", "단원안내·생각열기·탐구하기·확장하기 / 도입·전개·정리"],
  ["type", "enum", "intro · video · image · text(위지윅)"],
  ["title / description", "string", "항목 제목 · 설명 (흐름형 title=핵심용어)"],
  ["video_url / start·end", "url/int", "유튜브 URL · 재생 구간"],
  ["image_url / body", "url/html", "이미지 또는 위지윅 본문"],
];

function Table({ rows }: { rows: [string, string, string][] }) {
  return (
    <div style={{ border: "1px solid var(--color-slate-100)", borderRadius: 12, overflow: "hidden", marginBottom: 22 }}>
      <div style={{ display: "grid", gridTemplateColumns: "150px 90px 1fr", background: "var(--color-slate-50)", fontSize: 11, fontWeight: 800, color: "var(--color-slate-500)" }}>
        <div style={{ padding: "9px 12px" }}>컬럼</div>
        <div style={{ padding: "9px 12px" }}>타입</div>
        <div style={{ padding: "9px 12px" }}>설명</div>
      </div>
      {rows.map((r) => (
        <div key={r[0]} style={{ display: "grid", gridTemplateColumns: "150px 90px 1fr", borderTop: "1px solid var(--color-slate-100)", fontSize: 12 }}>
          <div style={{ padding: "9px 12px", fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--color-brand-700)" }}>{r[0]}</div>
          <div style={{ padding: "9px 12px", color: "var(--color-slate-400)", fontWeight: 600 }}>{r[1]}</div>
          <div style={{ padding: "9px 12px", color: "var(--color-slate-600)", fontWeight: 500 }}>{r[2]}</div>
        </div>
      ))}
    </div>
  );
}

export default function DataModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} labelledBy="datamodal-title">
      <div style={{ position: "sticky", top: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", background: "var(--color-brand-600)", color: "#fff" }}>
        <div>
          <div id="datamodal-title" style={{ fontSize: 16, fontWeight: 800 }}>데이터 구조 개요</div>
          <div style={{ fontSize: 11.5, fontWeight: 600, opacity: 0.85, marginTop: 2 }}>Google Sheet → 정적 JSON → Cloudflare Pages</div>
        </div>
        <button type="button" aria-label="닫기" onClick={onClose} style={{ width: 32, height: 32, border: "none", borderRadius: 9999, background: "rgba(255,255,255,.18)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <X size={16} />
        </button>
      </div>
      <div style={{ padding: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "var(--color-slate-400)", letterSpacing: ".04em", marginBottom: 10 }}>시트 1 — kits (수업꾸러미)</div>
        <Table rows={KIT_COLS} />
        <div style={{ fontSize: 12, fontWeight: 800, color: "var(--color-slate-400)", letterSpacing: ".04em", marginBottom: 10 }}>시트 2 — items (콘텐츠 항목)</div>
        <Table rows={ITEM_COLS} />
        <div style={{ display: "flex", gap: 12, padding: "16px 18px", background: "var(--color-brand-50)", border: "1px solid var(--color-brand-100)", borderRadius: 12 }}>
          <span style={{ fontSize: 18 }}>⚙️</span>
          <p style={{ margin: 0, fontSize: 12.5, fontWeight: 500, lineHeight: 1.7, color: "var(--color-slate-600)" }}>
            편집팀이 Google Sheet에 입력하고 <b>발행</b> 버튼을 누르면 GitHub 커밋 → Cloudflare Pages가 검증·새니타이즈 후 배포합니다. 조회수·좋아요만 런타임(D1)에서 집계합니다.
          </p>
        </div>
      </div>
    </Modal>
  );
}
