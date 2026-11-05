import './question.css'
import { useState } from 'react'
import { askQuestion } from '../api/api.js'

// doc: 문서 정보 (name, page 등) / addHistory: 기록 저장 / goHistory: 과거 질문 화면으로 이동
export default function QuestionPage({ doc, addHistory, goHistory, goSettings, goDocument }) {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [status, setStatus] = useState('')

  async function handleSend() {
    if (question.trim() === '') {
      setStatus('질문을 입력해 주세요.')
      return
    }
    setStatus('답변을 생성하는 중입니다.')

    try {
      const answerText = await askQuestion({ docId: doc.id, page: doc.page, question })
      setAnswer(answerText)
      addHistory({ id: Date.now(), page: doc.page, question, answer: answerText })
      setStatus('✓ 답변 생성 완료 · 기록 저장 완료')
    } catch {
      setStatus('답변 생성에 실패했습니다. 다시 시도해 주세요.')
    }
  }

  return (
    <div className="page qa">
      {/* ---------- 맨 위 바: 로고 / 경로 / 설정 버튼 ---------- */}
      <header className="topbar">
        <span className="logo" onClick={() => goDocument()}>📖 모두의 페이지</span>
        <div className="crumb">
          <span>자료실</span>
          <span>›</span>
          <span>{doc.name}</span>
          <span>›</span>
          <span className="crumb-badge">{doc.page}쪽 질문하기</span>
        </div>
        <div className="top-right">
          {/* 피그마엔 없지만 과거 질문으로 가는 길이 필요해서 넣어 둔 버튼 */}
          <button onClick={goHistory}>과거 질문</button>
          <button onClick={goSettings}>학습 방식 설정</button>
        </div>
      </header>

      {/* ---------- 제목 ---------- */}
      <div className="title-bar">
        <h1>문서 {doc.page}쪽에 질문하기</h1>
        <p className="sub">{doc.name} &nbsp;|&nbsp; 현재 위치: {doc.page}쪽</p>
      </div>

      {/* 답변이 없을 때 / 있을 때 안내 문구가 달라요 */}
      <p className="desc">
        {answer === ''
          ? `현재 문서 ${doc.page}쪽을 참고해 질문할 수 있습니다. 질문을 입력하고 보내기를 선택해 주세요.`
          : `현재 문서 ${doc.page}쪽의 내용을 참고해 질문해 주세요. 질문은 각각 독립적으로 처리됩니다.`}
      </p>

      {/* ---------- 질문 입력 ---------- */}
      <label htmlFor="q" className="label">질문 내용</label>
      <textarea
        id="q"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
      />

      {/* ---------- 버튼 줄 ---------- */}
      <div className="row">
        <button className="primary" onClick={handleSend}>▶ 질문 보내기</button>
        {status !== '' && <span className="status" aria-live="polite">{status}</span>}
      </div>

      {/* ---------- AI 답변 (답변이 있을 때만) ---------- */}
      {answer !== '' && (
        <section>
          <h2 className="answer-title">✧ AI 답변</h2>
          <div className="answer-box">{answer}</div>
        </section>
      )}

      {/* ---------- 맨 아래 버튼 ---------- */}
      <button className="back-btn" onClick={() => goDocument()}>
        ← 읽던 위치로 복귀하기
      </button>
    </div>
  )
}