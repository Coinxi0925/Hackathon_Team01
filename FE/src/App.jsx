import { useState } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import Layout from "./components/Layout";
import Settings from "./pages/Settings";
import Documents from "./pages/Documents";
import Reader from "./pages/Reader";
import QuestionPage from "./pages/question.jsx";
import QuestionList from "./pages/questionlist.jsx";
import Home from "./pages/Home.jsx";

export default function App() {
  const navigate = useNavigate();

  // 질문 기록 (두 화면이 같이 써서 여기서 보관)
  const [history, setHistory] = useState([]);

  // 현재 문서 정보 (나중에 PDF/문서 화면에서 채워줌)
  const [doc, setDoc] = useState({
    id: 1,
    name: "[업로드 파일이름.pdf]",
    topic: "[문서 주제]",
    page: "[쪽수]",
  });

  // 질문을 보내면 기록 맨 앞에 추가 (최신순)
  function addHistory(item) {
    setHistory((prev) => [item, ...prev]);
  }

  return (
    <Routes>
      {/* 팀원 화면: 공통 헤더(Layout) 안 */}
      <Route element={<Layout />}>
        <Route path="/settings" element={<Settings />} />
        <Route path="/documents" element={<Documents />} />
      </Route>

      {/* 홈: Layout 밖, 자체 헤더 사용 (소개 + 로그인) */}
      <Route path="/" element={<Home />} />

      {/* 문서 학습 화면 */}
      <Route
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
            goSettings={() => navigate("/settings")}
            goDocument={(pageNo) =>
              navigate(`/documents/${doc.id}/pages/${pageNo ?? doc.page}`)
            } 
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
            goSettings={() => navigate("/settings")}
            goDocument={(pageNo) =>
              navigate(`/documents/${doc.id}/pages/${pageNo ?? doc.page}`)
            }
          />
        }
      />
    </Routes>
  );
}