// ============================================================
// src/App.jsx
// 역할: "어떤 주소(URL)에서 어떤 화면을 보여줄지" 정하는 라우팅 지도
// - 모든 화면은 <Layout />(공통 헤더) 안에 들어감
// ============================================================
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Settings from "./pages/Settings";
import Documents from "./pages/Documents";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        {/* 첫 접속(/)하면 학습 방식 선택 화면으로 보냄 */}
        {/* [백엔드 연동] 로그인 기능이 붙으면: 로그인 전 → /login, 로그인 후 → /documents 로 분기하도록 변경 */}
        <Route path="/" element={<Navigate to="/settings" replace />} />

        {/* 화면 1: 학습 방식 선택 */}
        <Route path="/settings" element={<Settings />} />

        {/* 화면 2: 내 학습 자료실 */}
        <Route path="/documents" element={<Documents />} />

        {/* 화면 3: 문서 학습 (Reader) - 다음 작업에서 아래처럼 추가 예정
            <Route path="/documents/:id/pages/:pageNumber" element={<Reader />} /> */}
      </Route>
    </Routes>
  );
}