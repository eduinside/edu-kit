import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import SegmentedControl from "../components/SegmentedControl.tsx";
import KitCard from "../components/KitCard.tsx";
import DataModal from "../components/DataModal.tsx";
import { KITS } from "../lib/data.ts";
import type { Grade, Semester, Subject } from "../lib/data.ts";

const GRADE_OPTIONS = [3, 4, 5, 6].map((g) => ({ key: String(g), label: `${g}학년` }));
const SEM_OPTIONS = [{ key: "1학기", label: "1학기" }, { key: "2학기", label: "2학기" }];
const SUBJECT_OPTIONS = [{ key: "사회", label: "사회" }, { key: "과학", label: "과학" }];

const labelStyle = { fontSize: 11, fontWeight: 800, color: "var(--color-slate-400)", letterSpacing: ".04em" } as const;
const divider = { width: 1, height: 24, background: "var(--color-slate-100)" } as const;

export default function HomePage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [showData, setShowData] = useState(false);

  const grade = Number(params.get("grade") ?? 5) as Grade;
  const sem = (params.get("sem") ?? "2학기") as Semester;
  const subject = (params.get("subject") ?? "사회") as Subject;
  const unit = params.get("unit") ?? "전체";

  function setFilter(patch: Record<string, string>, resetUnit = false) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) next.set(k, v);
    if (resetUnit) next.set("unit", "전체");
    setParams(next, { replace: true });
  }

  const inScope = [...KITS.filter((k) => k.grade === grade && k.sem === sem && k.subject === subject)]
    .sort((a, b) => a.unit_no - b.unit_no || a.sort_order - b.sort_order);
  const daes = [...new Set(inScope.map((k) => k.unit))];
  const units = ["전체", ...daes];
  const shown = inScope.filter((k) => unit === "전체" || k.unit === unit);

  return (
    <div style={{ minHeight: "100vh", background: "var(--gradient-page)", fontFamily: "var(--font-sans)", color: "var(--color-ink)" }}>
      {/* 헤더 */}
      <div className="glassmorphism" style={{ position: "sticky", top: 0, zIndex: 30, height: 58, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: "var(--gradient-wordmark)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "var(--shadow-primary-soft)" }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /></svg>
          </div>
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.05 }}>
            <span style={{ fontWeight: 900, fontSize: 18, letterSpacing: "-.02em" }}>수업꾸러미</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--color-brand-600)", fontFamily: "var(--font-mono)" }}>kit.dgedu.link</span>
          </div>
        </div>
        <button type="button" onClick={() => setShowData(true)} style={{ height: 32, padding: "0 14px", border: "none", borderRadius: 8, background: "var(--color-slate-100)", color: "var(--color-slate-700)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>데이터 구조</button>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "34px 28px 64px" }}>
        {/* 인트로 */}
        <div style={{ marginBottom: 26 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 11px", background: "var(--color-brand-50)", borderRadius: 9999, marginBottom: 13 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-brand-500)" }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--color-brand-700)" }}>학년·학기·교과·단원으로 찾는 수업 콘텐츠</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 40, fontWeight: 800, letterSpacing: "-.025em" }}>오늘 수업, 어떤 꾸러미로 열까요?</h1>
          <p style={{ margin: "11px 0 0", fontSize: 15, fontWeight: 500, color: "var(--color-slate-500)", lineHeight: 1.6 }}>단원을 고르면 영상·자료·활동이 한 화면에 담긴 수업꾸러미가 열립니다.</p>
        </div>

        {/* 필터 카드 */}
        <div style={{ background: "#fff", border: "1px solid var(--color-slate-100)", borderRadius: 16, boxShadow: "0 1px 2px rgba(15,23,42,.06)", padding: "18px 20px", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span style={labelStyle}>학년</span>
              <SegmentedControl ariaLabel="학년" options={GRADE_OPTIONS} value={String(grade)} onChange={(k) => setFilter({ grade: k }, true)} />
            </div>
            <div style={divider} />
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span style={labelStyle}>학기</span>
              <SegmentedControl ariaLabel="학기" options={SEM_OPTIONS} value={sem} onChange={(k) => setFilter({ sem: k }, true)} />
            </div>
            <div style={divider} />
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span style={labelStyle}>교과</span>
              <SegmentedControl ariaLabel="교과" options={SUBJECT_OPTIONS} value={subject} onChange={(k) => setFilter({ subject: k }, true)} />
            </div>
          </div>
          <div style={{ height: 1, background: "var(--color-slate-100)", margin: "15px 0" }} />
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <span style={{ ...labelStyle, flexShrink: 0, paddingTop: 7 }}>단원</span>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {units.map((u) => {
                const active = u === unit;
                return (
                  <button key={u} type="button" className={active ? undefined : "unit-chip"} onClick={() => setFilter({ unit: u })}
                    style={{ height: 32, padding: "0 14px", borderRadius: 9999, cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap",
                      border: active ? "1px solid var(--color-brand-200)" : "1px solid var(--color-slate-200)",
                      color: active ? "var(--color-brand-700)" : "var(--color-slate-500)",
                      background: active ? "var(--color-brand-50)" : "#fff" }}>
                    {u}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 결과 헤더 */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-slate-500)" }}>{shown.length > 0 ? `수업꾸러미 ${shown.length}개` : "준비 중"}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-slate-400)" }}>초등 {grade}학년 · {sem} · {subject}</div>
        </div>

        {/* 그리드 / 빈 상태 */}
        {shown.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(252px, 1fr))", gap: 18 }}>
            {shown.map((k) => (
              <KitCard key={k.id} kit={k} onOpen={() => navigate(`/k/${k.id}`)} />
            ))}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "72px 20px", background: "#fff", border: "1px dashed var(--color-slate-200)", borderRadius: 16 }}>
            <div style={{ fontSize: 30, marginBottom: 10 }}>🗂️</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "var(--color-slate-600)" }}>선택하신 조건의 수업꾸러미가 아직 준비 중이에요</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-slate-400)", marginTop: 7 }}>샘플 데이터는 <b style={{ color: "var(--color-brand-600)" }}>초등 5학년 · 2학기 · 사회</b>에 준비되어 있어요.</div>
            <button type="button" onClick={() => setParams(new URLSearchParams({ grade: "5", sem: "2학기", subject: "사회", unit: "전체" }), { replace: true })}
              style={{ marginTop: 18, height: 38, padding: "0 18px", border: "none", borderRadius: 9999, background: "var(--color-brand-600)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "var(--shadow-primary-soft)" }}>
              5학년 2학기 사회 보기
            </button>
          </div>
        )}
      </div>

      <DataModal open={showData} onClose={() => setShowData(false)} />
    </div>
  );
}
