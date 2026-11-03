import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Documents from "./pages/Documents";
import Review from "./pages/Review";
import Settings from "./pages/Settings";

export default function App() {
  return (
    <Routes>
      {/* Layout(헤더+사이드바) 안에 아래 화면들이 번갈아 끼워져요 */}
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/documents" replace />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/review" element={<Review />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}