import { useEffect, useRef } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import HomePage from "./routes/HomePage.tsx";
import ViewerPage from "./routes/ViewerPage.tsx";

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

export default function App() {
  usePageViews();
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/:kitId" element={<ViewerPage />} />
      <Route path="/:kitId/:itemId" element={<ViewerPage />} />
      <Route path="*" element={<HomePage />} />
    </Routes>
  );
}
