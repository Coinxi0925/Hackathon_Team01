import { useState, useRef } from 'react'
import { askQuestion } from '../api/api.js'

// 질문 화면 컴포넌트 (App.jsx에서 이 이름으로 불러 써요)
export default function QuestionPage({ doc, addHistory, goHistory }) {
  // ---------- 기억할 값들 ----------
  const [question, setQuestion] = useState('')  // 입력창에 쓴 질문 (처음엔 빈 글자)
  const [answer, setAnswer] = useState('')      // AI 답변 (처음엔 비어 있음)
  const [status, setStatus] = useState('')      // "답변 생성 중..." 같은 안내 문구
  const answerRef = useRef(null)                // 답변 상자를 가리킬 표시

  // ---------- [질문 보내기] 버튼을 눌렀을 때 ----------
  async function handleSend() {
    // 질문이 비어 있으면 안내만 하고 끝냄
    if (question.trim() === '') {
      setStatus('질문을 입력해 주세요.')
      return
    }

    setStatus('답변을 생성하는 중입니다.')

    try {
        // 답변이 올 때까지 기다림 (await)
        const answerText = await askQuestion({
            docId: doc.id,
            page: doc.page,
            question,
        })

        setAnswer(answerText)

        addHistory({
            id: Date.now(),
            page: doc.page,
            question,
            answer: answerText,
        })

        setStatus('답변 생성 완료 · 기록 저장 완료')
    } 
    catch {
        // 답변을 못 받았을 때 (백엔드 오류 등)
        setStatus('답변 생성에 실패했습니다. 다시 시도해 주세요.')
    }
  }

  // ---------- [답변으로 이동] 버튼을 눌렀을 때 ----------
  function goAnswer() {
    // 답변 상자 위치까지 부드럽게 스크롤
    answerRef.current.scrollIntoView({ behavior: 'smooth' })
  }

  // ---------- 화면에 그려지는 부분 ----------
  return (
    <div className="card">
      {/* 맨 위 헤더 */}
      <header className="header">
        <span>모두의 페이지</span>
        <div>
          <button className="text-btn" onClick={goHistory}>과거 질문</button>
          <button className="text-btn">학습 방식 설정</button>
        </div>
        <button className="text-btn">학습 방식 설정</button>
      </header>

      {/* 제목 영역 */}
      <h1>문서 {doc.page}쪽에 질문하기</h1>
      <p className="sub">{doc.name} · {doc.topic}</p>
      <p>현재 문서 {doc.page}쪽의 텍스트를 참고해 답합니다. 질문은 각각 독립적으로 처리됩니다.</p>

      {/* 질문 입력창 */}
      <label htmlFor="q" className="label">질문 내용</label>
      <textarea
        id="q"
        value={question}                              // 입력창에 보이는 글자 = question 값
        onChange={(e) => setQuestion(e.target.value)} // 글자를 칠 때마다 question 값 갱신
      />

      {/* 버튼 줄 */}
      <div className="row">
        <button className="primary" onClick={handleSend}>질문 보내기</button>
        {/* answer가 비어 있으면(disabled) 누를 수 없게 막음 */}
        <button onClick={goAnswer} disabled={answer === ''}>답변으로 이동</button>
        {/* aria-live: 문구가 바뀌면 스크린리더가 읽어줌 (접근성) */}
        <span aria-live="polite">{status}</span>
      </div>

      {/* AI 답변 상자: answer에 글자가 있을 때만 보임 */}
      {answer !== '' && (
        <section className="box" ref={answerRef}>
          <h2>AI 답변</h2>
          <p>{answer}</p>
        </section>
      )}

      {/* 맨 아래 줄 */}
      <div className="row">
        <button onClick={() => alert('문서 화면은 아직 없어요')}>
          문서 {doc.page}쪽 본문 시작으로 돌아가기
        </button>
        <span>작성 중인 질문과 답변은 돌아와도 유지됩니다.</span>
      </div>

      <footer className="footer">05 / 모두의 페이지</footer>
    </div>
  )
}