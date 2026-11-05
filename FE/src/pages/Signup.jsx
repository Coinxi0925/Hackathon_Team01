
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './Signup.css'
import Logo from "../components/Logo";

export default function Signup() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  function handleSubmit(e) {
    e.preventDefault()

    setError('')
    setMessage('')

    if (email.trim() === '') {
      setError('이메일을 입력해 주세요.')
      return
    }

    if (password.length < 8) {
      setError('비밀번호는 8자 이상 입력해 주세요.')
      return
    }

    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }

    // 현재는 프론트엔드 입력값 검증만 진행합니다.
    // 실제 회원가입은 백엔드 API 연동 후 가능합니다.
    setMessage('입력값 확인이 완료되었습니다. 실제 회원가입은 백엔드 연동 후 이용할 수 있습니다.')
  }

  return (
    <div className="signup">
      <header className="signup-topbar">
        <Logo to="/" className="signup-logo" />
      </header>

      <main className="signup-main">
        <form className="signup-card" onSubmit={handleSubmit}>
          <h1>회원가입</h1>
          <p className="signup-sub">
            모두의 페이지에서 나만의 학습 공간을 만들어 보세요.
          </p>

          <label htmlFor="signup-email">아이디(이메일)</label>
          <input
            id="signup-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="이메일을 입력하세요."
            autoComplete="email"
            required
          />

          <label htmlFor="signup-password">비밀번호</label>
          <input
            id="signup-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="8자 이상 입력하세요."
            autoComplete="new-password"
            required
          />

          <label htmlFor="signup-confirm">비밀번호 확인</label>
          <input
            id="signup-confirm"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="비밀번호를 다시 입력하세요."
            autoComplete="new-password"
            required
          />

          {error !== '' && (
            <p className="signup-error" role="alert">{error}</p>
          )}

          {message !== '' && (
            <p className="signup-message" role="status">{message}</p>
          )}

          <button type="submit" className="signup-submit">
            회원가입
          </button>

          <p className="signup-login">
            이미 계정이 있으신가요?
            <button type="button" onClick={() => navigate('/')}>
              로그인하기
            </button>
          </p>
        </form>
      </main>
    </div>
  )
}
