import { X, Search, BookOpen, Link2, Heart, ClipboardList } from "lucide-react";
import Modal from "./Modal.tsx";

const SURVEY_URL = "https://dgedu.link/kit-form";

const STEPS: { icon: typeof Search; title: string; body: string }[] = [
  { icon: Search, title: "1. 찾기", body: "상단에서 학년·학기·교과를 고르고, ‘단원’ 칩으로 좁혀 원하는 수업꾸러미 카드를 찾으세요." },
  { icon: BookOpen, title: "2. 열기", body: "카드를 누르면 꾸러미가 열립니다. 왼쪽 목차의 단계(생각열기·탐구하기 등)를 따라 영상·이미지·읽기자료·활동을 순서대로 보여 주세요." },
  { icon: Link2, title: "3. 공유", body: "뷰어 오른쪽 위 ‘링크 복사’로 짧은 주소를 복사해 동료 교사나 학생과 나눌 수 있어요." },
  { icon: Heart, title: "4. 좋아요", body: "유용한 꾸러미에 하트를 눌러 두면 다른 선생님께도 활용도가 함께 전해집니다." },
];

export default function UsageGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} labelledBy="usage-title">
      <div style={{ position: "sticky", top: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", background: "var(--color-brand-600)", color: "#fff" }}>
        <div>
          <div id="usage-title" style={{ fontSize: 16, fontWeight: 800 }}>수업꾸러미 활용 안내</div>
          <div style={{ fontSize: 11.5, fontWeight: 600, opacity: 0.85, marginTop: 2 }}>한 화면에서 단원 수업을 순서대로</div>
        </div>
        <button type="button" aria-label="닫기" onClick={onClose} style={{ width: 32, height: 32, border: "none", borderRadius: 9999, background: "rgba(255,255,255,.18)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <X size={16} />
        </button>
      </div>

      <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
        {STEPS.map(({ icon: Icon, title, body }) => (
          <div key={title} style={{ display: "flex", gap: 14, padding: "16px 18px", background: "var(--color-slate-50)", borderRadius: 14 }}>
            <div style={{ flexShrink: 0, width: 38, height: 38, borderRadius: 10, background: "var(--color-brand-50)", color: "var(--color-brand-600)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon size={19} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "var(--color-ink)", marginBottom: 4 }}>{title}</div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 500, lineHeight: 1.7, color: "var(--color-slate-600)" }}>{body}</p>
            </div>
          </div>
        ))}

        <div style={{ display: "flex", gap: 12, padding: "16px 18px", background: "var(--color-brand-50)", border: "1px solid var(--color-brand-100)", borderRadius: 12 }}>
          <span style={{ fontSize: 18 }}>🧩</span>
          <p style={{ margin: 0, fontSize: 12.5, fontWeight: 500, lineHeight: 1.7, color: "var(--color-slate-600)" }}>
            꾸러미는 두 가지예요. <b style={{ color: "var(--color-slate-700)" }}>활동형</b>은 생각열기·탐구하기·확장하기로 이어지고, <b style={{ color: "var(--color-slate-700)" }}>핵심용어 흐름형</b>은 도입·전개·정리의 핵심 용어 영상으로 이어집니다.
          </p>
        </div>

        <a href={SURVEY_URL} target="_blank" rel="noopener noreferrer"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4, padding: "14px 18px", borderRadius: 12, background: "var(--color-brand-600)", color: "#fff", textDecoration: "none", fontSize: 13.5, fontWeight: 800, boxShadow: "var(--shadow-primary-soft)" }}>
          <ClipboardList size={17} strokeWidth={2.3} /> 수업꾸러미 설문에 참여하기
        </a>
        <p style={{ margin: "2px 0 0", textAlign: "center", fontSize: 11.5, fontWeight: 500, color: "var(--color-slate-400)", lineHeight: 1.6 }}>
          대구교육정보 에듀나비의{" "}
          <a href="https://www.edunavi.kr/arc/main.do" target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-brand-600)", fontWeight: 700, textDecoration: "none" }}>수업꾸러미</a>를 지원하기 위해 제작하였습니다.
        </p>
      </div>
    </Modal>
  );
}
