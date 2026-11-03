import { NavLink, Outlet, useLocation } from "react-router-dom";
import "./Layout.css";

const menus = [
  { to: "/documents", label: "내 강의자료", icon: "▣", step: "02 / 자료함" },
  { to: "/review", label: "통합 복습", icon: "☰", step: "04 / 통합 복습" },
  { to: "/settings", label: "학습 환경 설정", icon: "⚙", step: "01 / 학습 방식" },
];

export default function Layout() {
  const { pathname } = useLocation();
  const current = menus.find((m) => pathname.startsWith(m.to));

  return (
    <div className="layout">
      {/* 키보드 사용자가 Tab을 처음 누르면 나타나는 링크 */}
      <a href="#main" className="skip-link">
        본문으로 건너뛰기
      </a>

      <header className="app-header">
        <div className="app-header__brand">
          <span className="app-header__title">학습 공간</span>
          <span className="app-header__sub">포용사회 해커톤 · 접근성 학습 서비스</span>
        </div>
        <span className="pill" aria-label={`현재 단계: ${current?.step ?? ""}`}>
          {current?.step}
        </span>
      </header>

      <p className="breadcrumb">업로드 → 자료 변환 → 학습 시작</p>

      <div className="app-body">
        <aside className="sidebar">
          <nav aria-label="주 메뉴">
            <h2 className="sidebar__title">내 학습 공간</h2>
            <ul className="sidebar__list">
              {menus.map((menu) => (
                <li key={menu.to}>
                  {/* NavLink는 현재 페이지일 때 aria-current="page"를 자동으로 붙여줘요 */}
                  <NavLink
                    to={menu.to}
                    className={({ isActive }) =>
                      isActive ? "sidebar__link sidebar__link--active" : "sidebar__link"
                    }
                  >
                    <span aria-hidden="true">{menu.icon}</span>
                    {menu.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="sidebar__footer">
            <p>지원: 텍스트 중심 PDF</p>
            <p>이미지·표 설명은 확장 기능</p>
          </div>
        </aside>

        <main id="main" className="app-main" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}