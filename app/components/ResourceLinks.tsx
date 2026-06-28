import { ExternalLink } from "lucide-react";

// 외부 학습 자원 링크(새 창). 홈 푸터 + 퀴즈 화면 하단 공용.
const LINKS = [
  { href: "https://map.dgedu.link/", title: "에듀맵스", desc: "현장체험과 온라인 학습 자원을 찾아보세요." },
  { href: "https://ssac.dgedu.link/", title: "개념튼튼 ON싹", desc: "학년별 어휘와 개념을 스스로 익혀요." },
] as const;

export default function ResourceLinks({ heading }: { heading?: string }) {
  return (
    <div>
      {heading && (
        <div style={{ fontSize: 11, fontWeight: 800, color: "var(--color-slate-400)", letterSpacing: ".04em", marginBottom: 10, textAlign: "left" }}>{heading}</div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        {LINKS.map((l) => (
          <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className="resource-link"
            style={{ display: "flex", alignItems: "flex-start", gap: 11, padding: "14px 16px", borderRadius: 13, background: "#fff", border: "1px solid var(--color-slate-100)", boxShadow: "0 1px 2px rgba(15,23,42,.06)", textDecoration: "none", color: "inherit", textAlign: "left" }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: "var(--color-brand-700)" }}>{l.title}</span>
                <ExternalLink size={13} style={{ color: "var(--color-slate-400)", flexShrink: 0 }} aria-hidden />
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--color-slate-500)", marginTop: 3, lineHeight: 1.5 }}>{l.desc}</div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
