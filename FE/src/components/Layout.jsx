// ============================================================
// src/components/Layout.jsx
// 역할: 모든 화면이 공유하는 "공통 틀" (건너뛰기 링크 + 상단 헤더 + 본문 자리)
// - 헤더 오른쪽 버튼은 현재 주소(pathname)에 따라 화면마다 다르게 보여줌
// - <Outlet />이 있는 자리에 각 화면(Settings, Documents 등)이 끼워짐
// ============================================================
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import "./Layout.css";

// [수정 가능] 모드 값(명세서 3-4의 interface_type) → 화면에 보일 이름
const MODE_LABELS = {
  screen_reader: "스크린리더 중심",
  enlarged_reading: "확대해서 읽기",
  comfortable_reading: "읽기 편한 화면",
};

// [백엔드 연동] 지금은 브라우저(localStorage)에 저장된 모드를 읽음.
// 로그인 연동 후에는 GET /auth/me 또는 사용자 설정 API 응답의 interface_type을 쓰도록 바꾸기.
// (명세서에 설정 "조회" API가 없으므로 백엔드에 요청 필요)
function getMode() {
  try {
    return localStorage.getItem("interface_type") || "screen_reader";
  } catch {
    return "screen_reader"; // localStorage가 막힌 브라우저 대비
  }
}

export default function Layout() {
  const { pathname } = useLocation(); // 현재 주소 (예: /settings)
  const navigate = useNavigate(); // 버튼 클릭으로 화면 이동할 때 사용

  // 현재 어떤 화면인지 주소로 판단 (헤더 오른쪽 버튼을 바꾸는 기준)
  const isSettings = pathname.startsWith("/settings");
  // 문서 학습 화면 주소 형태: /documents/문서ID/pages/쪽번호
  const isStudy = /^\/documents\/[^/]+\/pages\//.test(pathname);

  return (
    <div className="layout">
      {/* 접근성: 키보드 Tab을 처음 누르면 나타나, 본문으로 바로 이동시켜 주는 링크 */}
      <a href="#main" className="skip-link">
        본문으로 바로가기
      </a>

      <header className="app-header">
        {/* 로고 + 서비스 이름. 클릭하면 자료실로 이동 */}
        {/* [수정 가능] 로고 이미지(SVG)를 받으면 📖 이모지를 <img>로 교체 */}
        <Link to="/documents" className="brand">
          <span aria-hidden="true">📖</span>
          <span className="brand__name">모두의 페이지</span>
        </Link>

        {/* [수정 가능] 헤더 부제 문구 */}
        <span className="brand__sub">
          {isStudy ? "AI 학습 공간" : "시각장애 대학생을 위한 AI 학습 서비스"}
        </span>

        <div className="app-header__right">
          {/* 1) 학습 방식 선택 화면: "학습 방식 안내" 버튼 */}
          {/* [수정 가능] 안내 페이지가 생기면 이동 경로를 그 주소로 변경 (지금은 자료실로 이동) */}
          {isSettings && (
            <button type="button" className="header-btn" onClick={() => navigate("/documents")}>
              학습 방식 안내 ↗
            </button>
          )}

          {/* 2) 내 학습 자료실: "학습 방식 설정" 버튼 → 설정 화면으로 이동 */}
          {!isSettings && !isStudy && (
            <button type="button" className="header-btn" onClick={() => navigate("/settings")}>
              ⚙ 학습 방식 설정 ↗
            </button>
          )}

          {/* 3) 문서 학습 화면: 현재 모드 표시 + 학습 환경 설정 버튼 */}
          {/* [수정 가능] 모드 표시를 눌러 바로 모드를 바꾸는 드롭다운은 추후 추가 */}
          {isStudy && (
            <>
              <span className="mode-pill">Aa {MODE_LABELS[getMode()]} ⌄</span>
              <button type="button" className="header-btn" onClick={() => navigate("/settings")}>
                ⚙ 학습 환경 설정
              </button>
            </>
          )}
        </div>
      </header>

      {/* 각 화면의 본문이 들어오는 자리. id="main"은 건너뛰기 링크의 목적지 */}
      <main id="main" className="app-main" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}