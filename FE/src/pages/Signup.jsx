import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './Signup.css'
import Logo from "../components/Logo";
import { registerUser } from '../api/api';

export default function Signup() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function handleSubmit(e) {
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

    try {
      await registerUser({ email, password })
      setMessage('회원가입이 완료되었습니다! 로그인 페이지로 이동합니다.')
      setTimeout(() => {
        navigate('/')
      }, 1500)

    } catch (err) {
      console.error('회원가입 에러:', err)
      // 백엔드에서 보내준 에러 메시지가 있다면 보여주고, 없으면 기본 메시지 출력
      const errorMsg = err.response?.data?.detail || '회원가입에 실패했습니다. 다시 시도해 주세요.'
      setError(errorMsg)
    }
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
