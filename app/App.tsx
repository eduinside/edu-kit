import { Routes, Route } from "react-router-dom";
import HomePage from "./routes/HomePage.tsx";
import ViewerPage from "./routes/ViewerPage.tsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/:kitId" element={<ViewerPage />} />
      <Route path="/:kitId/:itemId" element={<ViewerPage />} />
      <Route path="*" element={<HomePage />} />
    </Routes>
  );
}
