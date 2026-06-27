import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Search } from "lucide-react";
import SegmentedControl from "../components/SegmentedControl.tsx";
import KitCard from "../components/KitCard.tsx";
import UsageGuide from "../components/UsageGuide.tsx";
import SearchModal from "../components/SearchModal.tsx";
import { KITS } from "../lib/data.ts";
import type { Grade, Semester, Subject } from "../lib/data.ts";

const GRADE_OPTIONS = [3, 4, 5, 6].map((g) => ({ key: String(g), label: `${g}학년` }));
const SEM_OPTIONS = [{ key: "1학기", label: "1학기" }, { key: "2학기", label: "2학기" }];
const SUBJECT_OPTIONS = [{ key: "사회", label: "사회" }, { key: "과학", label: "과학" }];

const labelStyle = { fontSize: 11, fontWeight: 800, color: "var(--color-slate-400)", letterSpacing: ".04em" } as const;
const divider = { width: 1, height: 24, background: "var(--color-slate-100)" } as const;

type Scope = { grade: Grade; sem: Semester; subject: Subject };
const PREF_KEY = "edukit:lastScope";

// 폴백 기본 조건: 자료가 있는(공개된) 조건 중 가장 앞선 것(학년↑ → 1학기 → 사회). 없으면 5/2학기/사회.
const DEFAULT_SCOPE: Scope = (() => {
  const rank = (k: { grade: number; sem: Semester; subject: Subject }) =>
    k.grade * 100 + (k.sem === "1학기" ? 0 : 10) + (k.subject === "사회" ? 0 : 1);
  const pub = [...KITS.filter((k) => k.published)].sort((a, b) => rank(a) - rank(b));
  const f = pub[0];
  return f ? { grade: f.grade, sem: f.sem, subject: f.subject } : { grade: 5, sem: "2학기", subject: "사회" };
})();

// 접속 월 기반 학기: 3~8월 = 1학기, 9~2월 = 2학기.
function semByMonth(): Semester {
  const m = new Date().getMonth() + 1;
  return m >= 3 && m <= 8 ? "1학기" : "2학기";
}

// 최근 선택 복원(localStorage). 형식이 깨졌거나 없으면 null.
function loadPref(): Scope | null {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    const g = Number(p?.grade);
    if (![3, 4, 5, 6].includes(g)) return null;
    if (p?.sem !== "1학기" && p?.sem !== "2학기") return null;
    if (p?.subject !== "사회" && p?.subject !== "과학") return null;
    return { grade: g as Grade, sem: p.sem, subject: p.subject };
  } catch {
    return null;
  }
}

// 첫 진입(저장값 없음): 이번 달 학기 + 자료 있는 학년 중 무작위. 사회 우선, 없으면 과학, 그래도 없으면 폴백.
function randomDefaultByMonth(): Scope {
  const sem = semByMonth();
  for (const subject of ["사회", "과학"] as Subject[]) {
    const grades = [...new Set(KITS.filter((k) => k.published && k.sem === sem && k.subject === subject).map((k) => k.grade))];
    if (grades.length) return { grade: grades[Math.floor(Math.random() * grades.length)]!, sem, subject };
  }
  return DEFAULT_SCOPE;
}

// 초기 조건: 최근 선택 > (없으면) 월 기반 랜덤. URL 파라미터가 있으면 그것이 최우선(컴포넌트에서 처리).
function resolveInitialScope(): Scope {
  return loadPref() ?? randomDefaultByMonth();
}

// 사용자가 직접 고른 학년·학기·교과만 저장(랜덤 기본값은 저장하지 않음 → 다음 접속 시 다시 랜덤).
function persistScope(s: Scope) {
  try { localStorage.setItem(PREF_KEY, JSON.stringify(s)); } catch { /* 비공개 모드 등 */ }
}

// 홈 히어로 문구 — 접속할 때마다 8개 중 하나를 랜덤으로(따뜻한 톤).
const HERO_COPY: { title: string; subtitle: string }[] = [
  { title: "오늘 수업, 어떤 꾸러미로 열까요?", subtitle: "단원을 고르면 영상·자료·활동이 한 화면에 담긴 수업꾸러미가 열립니다." },
  { title: "오늘은 어떤 이야기로 아이들을 만날까요?", subtitle: "단원만 고르면 영상·자료·활동이 한자리에 모인 꾸러미가 펼쳐집니다." },
  { title: "수업 준비, 오늘은 가볍게 시작해요.", subtitle: "학년·학기·교과·단원으로 고르면 필요한 자료가 한 화면에 담깁니다." },
  { title: "선생님의 오늘 수업을 응원합니다.", subtitle: "단원을 고르면 영상·읽기자료·활동이 꾸러미 하나로 열립니다." },
  { title: "한 단원, 한 꾸러미면 충분해요.", subtitle: "흩어진 영상과 자료를 모아 한 화면에서 바로 수업하세요." },
  { title: "아이들과 나눌 한 시간, 여기서 시작해요.", subtitle: "단원을 고르면 영상·자료·활동이 담긴 수업꾸러미가 열립니다." },
  { title: "오늘 수업, 무엇으로 채워볼까요?", subtitle: "단원만 고르면 필요한 영상과 자료가 한 화면에 모입니다." },
  { title: "찾는 시간은 줄이고, 가르치는 시간은 늘려요.", subtitle: "학년·학기·교과·단원으로 고르면 수업꾸러미가 바로 열립니다." },
];

// 빈 상태일 때: 실제 자료가 있는(공개된) 조건 중 현재 선택과 가장 비슷한 것을 추천.
function recommendScope(grade: Grade, sem: Semester, subject: Subject) {
  const map = new Map<string, { grade: Grade; sem: Semester; subject: Subject; count: number }>();
  for (const k of KITS) {
    if (!k.published) continue;
    const key = `${k.grade}|${k.sem}|${k.subject}`;
    const e = map.get(key) ?? { grade: k.grade, sem: k.sem, subject: k.subject, count: 0 };
    e.count++;
    map.set(key, e);
  }
  const scopes = [...map.values()];
  if (!scopes.length) return null;
  const score = (x: { grade: Grade; sem: Semester; subject: Subject }) =>
    (x.grade === grade ? 2 : 0) + (x.subject === subject ? 1 : 0) + (x.sem === sem ? 1 : 0);
  scopes.sort((a, b) => score(b) - score(a) || b.count - a.count);
  return scopes[0]!;
}

export default function HomePage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [showGuide, setShowGuide] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  // 최초 마운트 1회만 결정(랜덤 학년 고정). URL 파라미터가 있으면 그것이 우선.
  const [initialScope] = useState(resolveInitialScope);
  // 히어로 문구도 마운트 시 1회 랜덤 선택(렌더마다 바뀌지 않도록)
  const [hero] = useState(() => HERO_COPY[Math.floor(Math.random() * HERO_COPY.length)]!);

  const grade = Number(params.get("grade") ?? initialScope.grade) as Grade;
  const sem = (params.get("sem") ?? initialScope.sem) as Semester;
  const subject = (params.get("subject") ?? initialScope.subject) as Subject;
  const unit = params.get("unit") ?? "전체";

  function setFilter(patch: Record<string, string>, resetUnit = false) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) next.set(k, v);
    if (resetUnit) next.set("unit", "전체");
    setParams(next, { replace: true });
    // 사용자가 고른 조건을 저장 → 다음 접속 시 복원
    persistScope({
      grade: Number(next.get("grade") ?? grade) as Grade,
      sem: (next.get("sem") ?? sem) as Semester,
      subject: (next.get("subject") ?? subject) as Subject,
    });
  }

  const inScope = [...KITS.filter((k) => k.grade === grade && k.sem === sem && k.subject === subject)]
    .sort((a, b) => a.unit_no - b.unit_no || a.sort_order - b.sort_order);
  const daes = [...new Set(inScope.map((k) => k.unit))];
  const units = ["전체", ...daes];
  const shown = inScope.filter((k) => unit === "전체" || k.unit === unit);
  const rec = shown.length === 0 ? recommendScope(grade, sem, subject) : null;

  return (
    <div style={{ minHeight: "100vh", background: "var(--gradient-page)", fontFamily: "var(--font-sans)", color: "var(--color-ink)" }}>
      {/* 헤더 */}
      <div className="glassmorphism" style={{ position: "sticky", top: 0, zIndex: 30, height: 58, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px" }}>
        <Link to="/" aria-label="수업꾸러미 홈" style={{ display: "flex", alignItems: "center", gap: 11, textDecoration: "none", color: "inherit" }}>
          <img src="/logo.png" width={30} height={30} alt="수업꾸러미 로고" style={{ display: "block", borderRadius: 8 }} />
          <span style={{ fontWeight: 900, fontSize: 18, letterSpacing: "-.02em" }}>수업꾸러미</span>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button type="button" onClick={() => setShowSearch(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 14px", border: "none", borderRadius: 8, background: "var(--color-brand-600)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            <Search size={15} strokeWidth={2.5} /> 검색
          </button>
          <button type="button" onClick={() => setShowGuide(true)} style={{ height: 32, padding: "0 14px", border: "none", borderRadius: 8, background: "var(--color-slate-100)", color: "var(--color-slate-700)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>활용 안내</button>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "34px 28px 64px" }}>
        {/* 인트로 */}
        <div style={{ marginBottom: 26 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 11px", background: "var(--color-brand-50)", borderRadius: 9999, marginBottom: 13 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-brand-500)" }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--color-brand-700)" }}>학년·학기·교과·단원으로 찾는 수업 콘텐츠</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 40, fontWeight: 800, letterSpacing: "-.025em" }}>{hero.title}</h1>
          <p style={{ margin: "11px 0 0", fontSize: 15, fontWeight: 500, color: "var(--color-slate-500)", lineHeight: 1.6 }}>{hero.subtitle}</p>
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
              <KitCard key={k.id} kit={k} onOpen={() => navigate(`/${k.id}`)} />
            ))}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "72px 20px", background: "#fff", border: "1px dashed var(--color-slate-200)", borderRadius: 16 }}>
            <div style={{ fontSize: 30, marginBottom: 10 }}>🗂️</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "var(--color-slate-600)" }}>선택하신 조건의 수업꾸러미가 아직 준비 중이에요</div>
            {rec ? (
              <>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-slate-400)", marginTop: 7 }}>
                  대신 <b style={{ color: "var(--color-brand-600)" }}>초등 {rec.grade}학년 · {rec.sem} · {rec.subject}</b>에 {rec.count}개가 준비되어 있어요.
                </div>
                <button type="button" onClick={() => setFilter({ grade: String(rec.grade), sem: rec.sem, subject: rec.subject }, true)}
                  style={{ marginTop: 18, height: 38, padding: "0 18px", border: "none", borderRadius: 9999, background: "var(--color-brand-600)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "var(--shadow-primary-soft)" }}>
                  초등 {rec.grade}학년 · {rec.sem} · {rec.subject} 보기
                </button>
              </>
            ) : (
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-slate-400)", marginTop: 7 }}>아직 공개된 수업꾸러미가 없어요.</div>
            )}
          </div>
        )}
      </div>

      <footer style={{ borderTop: "1px solid var(--color-slate-100)", padding: "26px 24px 36px", textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 500, color: "var(--color-slate-400)", lineHeight: 1.6 }}>
          대구교육정보 에듀나비의{" "}
          <a href="https://www.edunavi.kr/arc/main.do" target="_blank" rel="noopener noreferrer"
            style={{ color: "var(--color-brand-600)", fontWeight: 700, textDecoration: "none" }}>수업꾸러미</a>를 지원하기 위해 제작하였습니다.
        </p>
      </footer>

      <UsageGuide open={showGuide} onClose={() => setShowGuide(false)} />
      <SearchModal open={showSearch} onClose={() => setShowSearch(false)} />
    </div>
  );
}
