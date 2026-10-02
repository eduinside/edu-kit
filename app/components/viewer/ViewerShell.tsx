import { useEffect, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Menu, Flag } from "lucide-react";
import Sidebar from "./Sidebar.tsx";
import ContentPane, { VideoPlayer } from "./ContentPane.tsx";
import QuizPane from "./QuizPane.tsx";
import ReportModal from "../ReportModal.tsx";
import { hi } from "../Hi.tsx";
import type { ViewerGroup } from "../../lib/kit-content.ts";
import type { Item, Stage } from "../../lib/data.ts";
import type { QuizItem } from "../../lib/quiz.ts";
import { stageColor } from "../../lib/design.ts";

// 뷰어 껍데기 — 꾸러미 뷰어(ViewerPage)와 모음 뷰어(MixPage)가 함께 쓴다.
// 데이터(단계 묶음·퀴즈)와 상단 오른쪽 단추만 바깥에서 받고, 목차·서브헤더·재생·이전/다음·문제 알리기는 여기서.

const NARROW_Q = "(max-width: 860px)";
export const QUIZ_KEY = "_quiz"; // 단원 마지막 가상 "개념 확인" 화면의 item_key(라우트 /:kitId/_quiz)
const QUIZ_STAGE = "개념 확인";

export interface ReportTarget { kitId: string; kitTitle: string; itemKey: string }

export interface ViewerShellProps {
  crumb: string;
  title: string;
  hl?: string;
  groups: ViewerGroup[];
  flowLabel: string;
  itemKey?: string;                       // 라우트의 선택 항목
  onSelect: (key: string) => void;        // 항목 이동(주소 바꾸기)
  onBack: () => void;
  docTitle: (headTitle?: string) => string;
  topRight?: ReactNode;                   // 링크 복사·조회수·좋아요 등
  quiz?: QuizItem[];                      // 꾸러미 뷰어만(2문제 이상일 때 마지막 화면)
  quizKey?: string;                       // QuizPane 초기화 키
  sidebarNote?: string;                   // 모음 안내 글
  reportTarget: (item: Item) => ReportTarget | null;
  videoActions?: (item: Item) => ReactNode; // 영상 머리의 추가 단추(모음에 담기 등)
  emptyMessage?: string;
}

export default function ViewerShell(p: ViewerShellProps) {
  const initialNarrow = typeof window !== "undefined" && window.matchMedia(NARROW_Q).matches;
  const [isNarrow, setIsNarrow] = useState(initialNarrow);
  const [sidebarOpen, setSidebarOpen] = useState(!initialNarrow); // 모바일/탭에선 기본 숨김
  const [reportOpen, setReportOpen] = useState(false);

  // 화면 폭 변화 → 좁으면 사이드바 숨김(오버레이), 넓으면 표시
  useEffect(() => {
    const mq = window.matchMedia(NARROW_Q);
    const on = () => { setIsNarrow(mq.matches); setSidebarOpen(!mq.matches); };
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  function selectItem(k: string) {
    p.onSelect(k);
    if (isNarrow) setSidebarOpen(false); // 모바일: 선택 후 목차 닫기
  }

  const { groups, hl = "" } = p;
  const flat = groups.flatMap((g) => g.items);
  const quiz = p.quiz ?? [];
  const hasQuiz = quiz.length >= 2; // 풀 2개 미만이면 퀴즈 화면 미노출(점진 배포)
  const selKey = p.itemKey || flat[0]?.item_key || "";
  const onQuiz = hasQuiz && selKey === QUIZ_KEY;

  let sel: { group: ViewerGroup; item: Item } | null = null;
  for (const g of groups) {
    const it = g.items.find((i) => i.item_key === selKey);
    if (it) { sel = { group: g, item: it }; break; }
  }
  if (!onQuiz && !sel && groups[0]?.items[0]) sel = { group: groups[0], item: groups[0].items[0] };

  // 내비게이션 시퀀스 = 실제 항목들 + (있으면) 마지막 퀴즈 화면
  // 뱃지 색은 항목 sort_order가 아니라 단계(그룹) sort_order로 — 사이드바·서브헤더와 동일 색 보장
  const orderOf = new Map<Item, number>();
  for (const g of groups) for (const it of g.items) orderOf.set(it, g.sort_order);
  const stageOf = new Map<Item, Stage>();
  for (const g of groups) for (const it of g.items) stageOf.set(it, g.stage);
  type NavTarget = { key: string; stage: Stage; title: string; order?: number };
  const targets: NavTarget[] = [
    ...flat.map((i) => ({ key: i.item_key, stage: stageOf.get(i) ?? i.stage, title: i.title, order: orderOf.get(i) })),
    ...(hasQuiz ? [{ key: QUIZ_KEY, stage: QUIZ_STAGE as Stage, title: QUIZ_STAGE }] : []),
  ];
  const curKey = onQuiz ? QUIZ_KEY : (sel?.item.item_key ?? selKey);
  const curIdx = targets.findIndex((t) => t.key === curKey);
  const prevItem = curIdx > 0 ? targets[curIdx - 1]! : null;
  const nextItem = curIdx >= 0 && curIdx < targets.length - 1 ? targets[curIdx + 1]! : null;

  const headStage: Stage = onQuiz ? (QUIZ_STAGE as Stage) : (sel?.group.stage ?? "단원안내");
  const headTitle = onQuiz ? QUIZ_STAGE : sel?.item.title;

  // 항목별 문서 제목 — 탭/링크 미리보기 + GA4 page_view의 page_title(콘텐츠별 조회 분석)
  const docTitle = p.docTitle(headTitle);
  useEffect(() => {
    document.title = docTitle;
    return () => { document.title = "수업꾸러미"; };
  }, [docTitle]);

  const report = sel?.item.type === "video" ? p.reportTarget(sel.item) : null;

  const navButtons = (sel || onQuiz) && (prevItem || nextItem) ? (
    <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
      <NavButton dir="prev" target={prevItem} onSelect={selectItem} />
      <NavButton dir="next" target={nextItem} onSelect={selectItem} />
    </div>
  ) : null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "var(--color-paper)", display: "flex", flexDirection: "column", fontFamily: "var(--font-sans)", color: "var(--color-ink)" }}>
      {/* 상단 바 */}
      <div style={{ height: 60, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "0 18px", background: "#fff", borderBottom: "1px solid var(--color-slate-100)", boxShadow: "0 1px 1px rgba(15,23,42,.04)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
          <button type="button" className="icon-btn" aria-label="목록으로" onClick={p.onBack} style={{ width: 36, height: 36, flexShrink: 0, border: "1px solid var(--color-slate-200)", borderRadius: 9999, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-slate-600)", cursor: "pointer" }}>
            <ChevronLeft size={17} />
          </button>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-slate-400)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.crumb}</div>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{hi(p.title, hl)}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 9, flexShrink: 0 }}>{p.topRight}</div>
      </div>

      {/* 본문 */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", position: "relative" }}>
        {sidebarOpen && (sel || onQuiz) && isNarrow && (
          // 모바일/탭: 오버레이 + scrim (본문을 밀지 않음)
          <div onClick={() => setSidebarOpen(false)} style={{ position: "absolute", inset: 0, zIndex: 20, background: "rgba(15,23,42,.4)" }} />
        )}
        {sidebarOpen && (sel || onQuiz) && (
          <div style={isNarrow
            ? { position: "absolute", left: 0, top: 0, bottom: 0, zIndex: 21, boxShadow: "4px 0 24px rgba(15,23,42,.18)" }
            : { display: "contents" }}>
            <Sidebar groups={groups} selKey={curKey} flowLabel={p.flowLabel} note={p.sidebarNote}
              onSelect={selectItem} onClose={() => setSidebarOpen(false)}
              quiz={hasQuiz ? { active: onQuiz, onSelect: () => selectItem(QUIZ_KEY) } : undefined} />
          </div>
        )}

        <div className="sk-scroll" style={{ flex: 1, minWidth: 0, overflowY: "auto", background: "var(--color-paper)" }}>
          {/* sticky 서브헤더 */}
          <div style={{ position: "sticky", top: 0, zIndex: 5, background: "rgba(243,245,249,.86)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", borderBottom: "1px solid var(--color-slate-100)", padding: "9px 24px 10px" }}>
            {/* 태그는 왼쪽 칸, 제목+설명은 오른쪽 칸 — 설명이 제목에 맞춰 내어쓰기(태그 아래는 비움) */}
            <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", alignItems: "flex-start", gap: 9 }}>
              {!sidebarOpen && (
                <button type="button" className="icon-btn" onClick={() => setSidebarOpen(true)} aria-label="목차 펼치기" style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 28, padding: "0 11px", border: "1px solid var(--color-slate-200)", borderRadius: 9999, background: "#fff", cursor: "pointer", color: "var(--color-slate-600)", fontSize: 11.5, fontWeight: 700, flexShrink: 0, marginTop: 2 }}>
                  <Menu size={13} /> 목차
                </button>
              )}
              {(sel || onQuiz) && (() => {
                const st = stageColor(headStage, sel?.group.sort_order);
                return <span style={{ flexShrink: 0, marginTop: 3, display: "inline-flex", alignItems: "center", padding: "3px 11px", borderRadius: 9999, background: st.soft, color: st.text, fontSize: 12, fontWeight: 800, lineHeight: 1, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{headStage}</span>;
              })()}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1.4 }}>{headTitle ? hi(headTitle, hl) : "준비 중"}</div>
                {sel?.group.question && <div style={{ marginTop: 5, fontSize: 11.5, fontWeight: 700, color: "var(--color-slate-400)" }}>탐구질문 · {sel.group.question}</div>}
                {sel && (() => {
                  const d = sel.item.type === "video" ? sel.item.video_desc : sel.item.type === "intro" ? sel.item.description : undefined;
                  return d ? <div style={{ marginTop: 5, fontSize: 13.5, fontWeight: 500, color: "var(--color-slate-600)", lineHeight: 1.55 }}>{hi(d, hl)}</div> : null;
                })()}
                {sel?.item.type === "video" && sel.item.caption && <div style={{ marginTop: 3, fontSize: 11.5, fontWeight: 500, color: "var(--color-slate-400)" }}>{sel.item.caption}</div>}
                {/* 출처 — 영상을 올린 유튜브 채널(npm run videos가 기록). 교사가 자료의 신뢰를 판단하는 단서. */}
                {sel?.item.type === "video" && (
                  <div style={{ marginTop: 4, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 12px", fontSize: 11.5, fontWeight: 600, color: "var(--color-slate-400)" }}>
                    {sel.item.channel && <span>출처 · {sel.item.channel} (YouTube)</span>}
                    {report && (
                      <button type="button" onClick={() => setReportOpen(true)} className="report-link"
                        style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: 0, border: 0, background: "none", cursor: "pointer", font: "inherit", color: "var(--color-slate-400)", textDecoration: "underline", textUnderlineOffset: 2 }}>
                        <Flag size={11} aria-hidden /> 문제 알리기
                      </button>
                    )}
                    {p.videoActions?.(sel.item)}
                  </div>
                )}
              </div>
            </div>
          </div>

          {onQuiz ? (
            <div style={{ maxWidth: 1280, margin: "0 auto", padding: "26px 24px 80px" }}>
              <QuizPane key={p.quizKey} quiz={quiz} />
              {navButtons}
            </div>
          ) : sel?.item.type === "video" ? (
            // 순서: (서브헤더)태그+제목+설명 → 영상(영화관 풀폭) → 내비게이션
            <>
              <VideoPlayer key={sel.item.id} it={sel.item} />
              <div style={{ maxWidth: 1280, margin: "0 auto", padding: "20px 24px 80px" }}>
                {navButtons}
              </div>
            </>
          ) : (
            <div style={{ maxWidth: 1280, margin: "0 auto", padding: "26px 24px 80px" }}>
              {sel ? <ContentPane item={sel.item} stage={sel.group.stage} hl={hl} />
                : p.emptyMessage ? <div style={{ textAlign: "center", padding: "80px 20px", fontSize: 15, fontWeight: 800, color: "var(--color-slate-600)" }}>{p.emptyMessage}</div>
                : <ContentPane item={null} stage={"단원안내"} hl={hl} />}
              {navButtons}
            </div>
          )}
        </div>
      </div>
      {report && sel && (
        <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} kitId={report.kitId} kitTitle={report.kitTitle}
          item={{ item_key: report.itemKey, title: sel.item.title, video_id: sel.item.video_id }} />
      )}
    </div>
  );
}

function NavButton({ dir, target, onSelect }: { dir: "prev" | "next"; target: { key: string; stage: Stage; title: string; order?: number } | null; onSelect: (k: string) => void }) {
  const isPrev = dir === "prev";
  const enabled = !!target;
  return (
    <button
      type="button"
      disabled={!enabled}
      onClick={() => target && onSelect(target.key)}
      style={{
        flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 10,
        justifyContent: isPrev ? "flex-start" : "flex-end",
        padding: "13px 16px", borderRadius: 14,
        border: "1px solid var(--color-slate-100)",
        background: enabled ? "#fff" : "transparent",
        boxShadow: enabled ? "0 1px 2px rgba(15,23,42,.06)" : "none",
        cursor: enabled ? "pointer" : "default", opacity: enabled ? 1 : 0.55,
        transition: "box-shadow .15s ease, border-color .15s ease",
      }}
    >
      {isPrev && <ChevronLeft size={18} style={{ color: "var(--color-slate-400)", flexShrink: 0 }} />}
      <span style={{ minWidth: 0, textAlign: isPrev ? "left" : "right" }}>
        <span style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--color-slate-400)" }}>{isPrev ? "이전" : "다음"}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, justifyContent: isPrev ? "flex-start" : "flex-end" }}>
          {target && (() => {
            const st = stageColor(target.stage, target.order);
            return <span style={{ flexShrink: 0, padding: "2px 8px", borderRadius: 9999, background: st.soft, color: st.text, fontSize: 10, fontWeight: 800, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{target.stage}</span>;
          })()}
          <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--color-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>
            {target ? target.title : isPrev ? "처음입니다" : "마지막입니다"}
          </span>
        </span>
      </span>
      {!isPrev && <ChevronRight size={18} style={{ color: "var(--color-slate-400)", flexShrink: 0 }} />}
    </button>
  );
}
