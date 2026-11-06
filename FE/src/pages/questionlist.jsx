import './question.css'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Logo from "../components/Logo";
import { getSavedQuestions } from '../api/api';

// doc: 문서 정보 / history: 질문 기록 목록 / goQuestion: 질문 화면으로 이동
export default function QuestionList({doc = { name: '문서' }, goQuestion, goSettings, goDocument }) {
  const [history, setHistory] = useState([]) // 과거 질문 목록 상태
  const [loading, setLoading] = useState(true) // 로딩 상태
  const [openIds, setOpenIds] = useState([]) // 펼쳐진 질문 id들
  const navigate = useNavigate()

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        setLoading(true)
        const data = await getSavedQuestions()

        const questionList = Array.isArray(data) ? data : (data.items || [])
        setHistory(questionList)
      
      } catch (err) {
        console.error('과거 질문 목록을 불러오는 중 에러 발생:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchQuestions()
  }, [])

  function toggle(id) {
    if (openIds.includes(id)) {
      setOpenIds(openIds.filter((x) => x !== id))
    } else {
      setOpenIds([...openIds, id])
    }
  }

  return (
    <div className="page qa">
      <header className="topbar">
        <Logo to="/documents" className="logo" />
        <div className="crumb">
          <span>자료실</span>
          <span>›</span>
          <span>{doc.name}</span>
          <span>›</span>
          <span className="crumb-badge">과거 질문</span>
        </div>
        <div className="top-right">
          <button onClick={goSettings}>학습 방식 설정</button>
        </div>
      </header>

      {/* ---------- 돌아가기 링크 ---------- */}
      <div className="back-link">
        <button onClick={() => navigate('/documents')}>‹ 모두의 페이지로 돌아가기</button>
      </div>

      {/* ---------- 제목 줄 ---------- */}
      <div className="list-title">
        <div>
          <h1>과거 질문</h1>
          <p className="sub">{doc.name}에서 나눈 질문과 답변을 확인할 수 있습니다.</p>
        </div>
        <button onClick={goQuestion}>↶ 질문 화면으로 돌아가기</button>
      </div>

      <p className="sub">최신 질문순</p>

      {history.length === 0 && <p className="empty">아직 질문 기록이 없습니다.</p>}

      {/* ---------- 질문 카드들 ---------- */}
      {history.map((item) => {
        const open = openIds.includes(item.id) // 이 카드가 펼쳐져 있는지
        return (
          <div className="card" key={item.id}>
            <div className="card-head">
              <span className="badge">문서 {item.page}쪽</span>
              <h2>{item.question}</h2>
              <button onClick={() => goDocument(item.page)}>
                ↗ 문서 {item.page}쪽으로 이동
              </button>
            </div>

            {/* 펼쳐졌을 때만 답변 보임 */}
            {open && <p className="answer-line"><b>답변:</b> {item.answer}</p>}

            <button className="toggle-btn" onClick={() => toggle(item.id)}>
              {open ? '∧ 답변 접기' : '∨ 답변 펼치기'}
            </button>
          </div>
        )
      })}
    </div>
  )
}