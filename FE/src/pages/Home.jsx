import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import heroImg from '../assets/pageofall.png'
import './Home.css'
import Logo from "../components/Logo";

// 주요 기능 카드 4개
const FEATURES = [
  { icon: '📄', title: '강의자료 읽기', desc: 'PDF 자료를 구조화하여 편리하게 탐색해요.' },
  { icon: '💬', title: 'AI에 질문하기', desc: '내용을 이해하다 궁금한 점을 바로 물어봐요.' },
  { icon: '🔄', title: '읽던 위치로 복귀', desc: '질문 후에도 읽던 페이지에서 다시 이어가요.' },
  { icon: '📚', title: '복습하기', desc: '이전 질문과 답변을 한눈에 모아 복습할 수 있어요.' },
]

export default function Home() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  // [로그인] 버튼을 눌렀을 때
  function handleSubmit(e) {
    e.preventDefault()

    if (email.trim() === '') {
      setError('이메일을 입력해 주세요.')
      return
    }
    if (password === '') {
      setError('비밀번호를 입력해 주세요.')
      return
    }
    setError('')

    // [백엔드 연동] 나중에 여기서 로그인 API를 호출하세요.
    // 지금은 검사만 통과하면 자료실로 이동합니다.
    navigate('/documents')
  }

  return (
    <div className="home">
      <header className="home-topbar">
        <Logo to="/" className="home-logo" />
        <div className="home-nav">
          <button type="button" className="home-btn-outline" onClick={() => navigate('/')}>
            로그인
          </button>
          {/* 회원가입 화면은 팀원 담당: 주소가 다르면 '/Signup'만 바꾸세요 */}
          <button type="button" className="home-btn-fill" onClick={() => navigate('/Signup')}>
            회원가입
          </button>
        </div>
      </header>

      <div className="home-body">
        {/* ---------- 왼쪽: 서비스 소개 ---------- */}
        <section className="home-left">
          <span className="home-badge">♿ 접근성 중심 AI 학습 서비스</span>

          {/* 제목 + 문구 + 버튼(왼쪽) / 이미지(오른쪽) */}
          <div className="home-hero">
            <div className="home-hero-text">
              <h1>모두의 페이지</h1>
              <p className="home-lead">
                모두가 학습 장벽 없이,<br />
                원하는 방식으로 공부할 수 있는<br />
                AI 학습 공간입니다.
              </p>
              {/* 눌러도 아무 반응 없는 버튼 */}
              <button type="button" className="home-start">
                지금 시작하기
              </button>
            </div>

            <div className="home-hero-image">
              <img src={heroImg} alt="헤드폰을 쓰고 책을 읽는 캐릭터" />
            </div>
          </div>

          <h2>주요 기능</h2>
          <div className="home-features">
            {FEATURES.map((f) => (
              <div className="home-feature" key={f.title}>
                <div className="home-feature-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>

          <div className="home-notice">
            ♿ <b>접근성 안내</b> 스크린리더, 키보드만으로도 편리하게 이용할 수 있습니다.
          </div>
        </section>

        {/* ---------- 오른쪽: 로그인 (세로로 길게) ---------- */}
        <aside className="home-right">
          <form className="home-card" onSubmit={handleSubmit}>
            <h2>로그인</h2>
            <p className="home-card-sub">
              모두의 페이지에 오신 것을 환영합니다. 나만의 학습 공간을 이용해 보세요.
            </p>

            <label htmlFor="email">아이디(이메일)</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="이메일을 입력하세요."
            />

            <label htmlFor="password">비밀번호</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요."
            />

            {error !== '' && <p className="home-error" role="alert">{error}</p>}

            <button type="submit" className="home-submit">로그인</button>
          </form>
        </aside>
      </div>
    </div>
  )
}