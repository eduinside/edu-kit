import { lazy, Suspense, useEffect, useRef } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { MessageCircleQuestion } from "lucide-react";
import HomePage from "./routes/HomePage.tsx";
// 뷰어는 지연 로드 — 무거운 items.json(~600KB)을 홈 번들에서 분리
const ViewerPage = lazy(() => import("./routes/ViewerPage.tsx"));

const SURVEY_URL = "https://dgedu.link/kit-form";

// 전 화면 공통 우하단 플로팅 설문 버튼(아이콘 1개, 호버 시 툴팁, 저채도). 뷰어 zIndex 50 위로.
function SurveyFab() {
  return (
    <a href={SURVEY_URL} target="_blank" rel="noopener noreferrer" aria-label="수업꾸러미 설문" className="survey-fab"
      style={{ position: "fixed", right: 20, bottom: 20, zIndex: 60, width: 46, height: 46, borderRadius: 9999, background: "var(--color-slate-500)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none", boxShadow: "0 6px 18px rgba(15,23,42,.22)" }}>
      <MessageCircleQuestion size={23} strokeWidth={2.1} />
      <span className="survey-fab__tip" role="tooltip">수업꾸러미 설문</span>
    </a>
  );
}

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

// SPA 라우트 변경마다 GA4 page_view 전송(최초 view는 index.html의 gtag config가 보냄)
function usePageViews() {
  const loc = useLocation();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.gtag?.("event", "page_view", {
      page_path: loc.pathname + loc.search,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [loc]);
}

const viewerFallback = <div style={{ position: "fixed", inset: 0, background: "var(--color-paper)" }} />;

export default function App() {
  usePageViews();
  return (
    <>
      <Suspense fallback={viewerFallback}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/:kitId" element={<ViewerPage />} />
          <Route path="/:kitId/:itemId" element={<ViewerPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <SurveyFab />
    </>
  );
}
