import { useState } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import Layout from "./components/Layout";
import Settings from "./pages/Settings";
import Documents from "./pages/Documents";
import Reader from "./pages/Reader";
import QuestionPage from "./pages/question.jsx";      // [내 화면] 질문 화면
import QuestionList from "./pages/questionlist.jsx";  // [내 화면] 과거 질문 화면

export default function App() {
  const navigate = useNavigate();

  // [내 화면용] 질문 기록 (두 화면이 같이 써서 여기서 보관)
  const [history, setHistory] = useState([]);

  // [내 화면용] 현재 문서 정보 (나중에 PDF/문서 화면에서 채워줌)
  const [doc, setDoc] = useState({
    id: 1,
    name: "[업로드 파일이름.pdf]",
    topic: "[문서 주제]",
    page: "[쪽수]",
  });

  // 질문을 보내면 기록 맨 앞에 추가 (최신순) (prev추가)
  function addHistory(item) {
    setHistory((prev) => [item, ...prev]);
  }

    return (
    <Routes>
      {/* 팀원 화면: 공통 헤더(Layout) 안 */}
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/settings" replace />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/documents" element={<Documents />} />
      </Route>

            {/* 문서 학습 화면 */}
<Route //route 추가
  path="/documents/:id/pages/:pageNumber"
  element={
    <Reader
      onAsk={(pageInfo) => {
        setDoc(pageInfo);
        navigate("/question");
      }}
      onHistory={(pageInfo) => {
  setDoc(pageInfo);
  navigate("/history");
}}
    />
  }
/>

      {/* 내 화면: Layout 밖 (자체 헤더 사용, 화면 꽉 차게) */}
      <Route
        path="/question"
        element={
          <QuestionPage
            doc={doc}
            addHistory={addHistory}
            goHistory={() => navigate("/history")}
          />
        }
      />
      <Route
        path="/history"
        element={
          <QuestionList
            doc={doc}
            history={history}
            goQuestion={() => navigate("/question")}
          />
        }
      />
    </Routes>
  );
}