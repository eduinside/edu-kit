import { useEffect, useState } from "react";
import { useNavigate, useParams, Navigate, useSearchParams } from "react-router-dom";
import { Link2, Eye, Heart, Check, Plus } from "lucide-react";
import ViewerShell from "../components/viewer/ViewerShell.tsx";
import { getKit } from "../lib/data.ts";
import { getGroups } from "../lib/kit-content.ts";
import { getQuiz } from "../lib/quiz.ts";
import { flowLabel } from "../lib/design.ts";
import { statsFor } from "../lib/stats.ts";
import { postView, postLike, type Stats } from "../lib/api.ts";
import { ref, toggleBasket, useBasket, MAX_MIX } from "../lib/mix.ts";

// 꾸러미 뷰어 — 데이터(단계 묶음·퀴즈)와 상단 단추(링크 복사·조회수·좋아요)를 껍데기(ViewerShell)에 넘긴다.
export default function ViewerPage() {
  const { kitId = "", itemId } = useParams();
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const hl = sp.get("q") || ""; // 검색으로 진입 시 하이라이트할 키워드
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState<Stats>(() => ({ ...statsFor(kitId), liked: false }));
  const basket = useBasket();
  const [full, setFull] = useState(false);

  // 진입 시 조회수 집계 + 라이브 stats 수신. Functions 미가동(dev)이면 시드 유지.
  useEffect(() => {
    setStats({ ...statsFor(kitId), liked: false });
    let cancelled = false;
    postView(kitId).then((s) => { if (!cancelled) setStats(s); }).catch(() => { /* 시드 폴백 */ });
    return () => { cancelled = true; };
  }, [kitId]);

  async function toggleLike() {
    const next = !stats.liked;
    const prev = stats;
    setStats({ ...stats, liked: next, likes: Math.max(0, stats.likes + (next ? 1 : -1)) }); // 낙관적
    try { setStats(await postLike(kitId, next)); } catch { setStats(prev); } // 실패 시 롤백
  }

  const kit = getKit(kitId);
  // 존재하지 않는 꾸러미 id(404 등)는 랜딩으로 자동 이동
  if (!kit) return <Navigate to="/" replace />;

  function copyLink() {
    try { navigator.clipboard?.writeText(`https://kit.dgedu.link/${kitId}`); } catch { /* noop */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  const topRight = (
    <>
      <button type="button" className="icon-btn copy-btn" onClick={copyLink} aria-label="링크 복사" style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 34, padding: "0 13px", border: "1px solid var(--color-slate-200)", borderRadius: 9999, background: "var(--color-slate-50)", cursor: "pointer", whiteSpace: "nowrap" }}>
        {copied ? <Check size={14} style={{ color: "var(--color-success-600, #059669)" }} /> : <Link2 size={13} style={{ color: "var(--color-slate-400)" }} />}
        <span className="copy-label" style={{ fontSize: 11.5, fontWeight: 800, color: copied ? "var(--color-success-700, #047857)" : "var(--color-brand-600)" }}>{copied ? "복사됨!" : "링크 복사"}</span>
      </button>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 34, padding: "0 12px", borderRadius: 9999, background: "var(--color-slate-50)", fontSize: 12, fontWeight: 700, color: "var(--color-slate-500)" }} aria-label={`조회수 ${stats.views}회`}>
        <Eye size={14} /> {stats.views}
      </span>
      <button type="button" onClick={toggleLike} aria-pressed={stats.liked} aria-label="좋아요"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 34, padding: "0 13px", borderRadius: 9999, cursor: "pointer", fontSize: 12, fontWeight: 800, transition: "all .2s ease",
          border: `1px solid ${stats.liked ? "var(--color-danger-100)" : "var(--color-slate-200)"}`, background: stats.liked ? "var(--color-danger-50)" : "#fff", color: stats.liked ? "var(--color-danger)" : "var(--color-slate-500)" }}>
        <span className={stats.liked ? "sk-pop" : undefined} style={{ display: "inline-flex" }}>
          <Heart size={15} fill={stats.liked ? "var(--color-danger)" : "none"} />
        </span>
        {stats.likes}
      </button>
    </>
  );

  return (
    <ViewerShell
      crumb={`초등 ${kit.grade}학년 · ${kit.sem} · ${kit.subject}`}
      title={kit.title}
      hl={hl}
      groups={getGroups(kitId)}
      flowLabel={flowLabel(kit.flow)}
      itemKey={itemId}
      onSelect={(k) => navigate(`/${kitId}/${k}`)}
      onBack={() => navigate("/")}
      docTitle={(head) => `${head ? head + " · " : ""}${kit.title} · 수업꾸러미`}
      topRight={topRight}
      quiz={getQuiz(kitId)}
      quizKey={kitId}
      reportTarget={(item) => ({ kitId, kitTitle: kit.title, itemKey: item.item_key })}
      videoActions={(item) => {
        const r = ref(kitId, item.item_key);
        const inBasket = basket.includes(r);
        return (
          <button type="button" aria-pressed={inBasket}
            onClick={() => { const ok = toggleBasket(r); setFull(!ok); }}
            title={full && !inBasket ? `모음에는 ${MAX_MIX}개까지 담을 수 있어요` : undefined}
            style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 9px", borderRadius: 999, cursor: "pointer", font: "inherit",
              border: `1px solid ${inBasket ? "var(--color-brand-200, #bfdbfe)" : "var(--color-slate-200)"}`,
              background: inBasket ? "var(--color-brand-50, #eff6ff)" : "#fff", color: inBasket ? "var(--color-brand-700, #1d4ed8)" : "var(--color-slate-500)" }}>
            {inBasket ? <Check size={11} aria-hidden /> : <Plus size={11} aria-hidden />}
            {inBasket ? "모음에 담김" : full ? `모음은 ${MAX_MIX}개까지` : "모음에 담기"}
          </button>
        );
      }}
    />
  );
}
