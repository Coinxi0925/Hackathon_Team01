import { useState } from 'react'

// 과거 질문 화면
// history: App.jsx가 넘겨준 질문 기록 목록
// goQuestion: 질문 화면으로 돌아가는 함수 (App.jsx가 넘겨줌)
export default function QuestionList({ doc, history, goQuestion }) {
  // 지금 펼쳐져 있는 질문의 id들을 기억 (처음엔 모두 접힘)
  const [openIds, setOpenIds] = useState([])

  // [답변 내용 펼치기/접기] 버튼을 눌렀을 때
  function toggle(id) {
    if (openIds.includes(id)) {
      setOpenIds(openIds.filter((x) => x !== id)) // 펼쳐져 있으면 접기
    } else {
      setOpenIds([...openIds, id])                // 접혀 있으면 펼치기
    }
  }

  return (
    <div className="card">
      <header className="header">
        <span>모두의 페이지</span>
        <button className="text-btn">학습 방식 설정</button>
      </header>

      {/* 제목 줄: 왼쪽 제목, 오른쪽 돌아가기 버튼 */}
      <div className="title-row">
        <div>
          <h1>과거 질문</h1>
          <p className="sub">{doc.name}의 기록만 표시합니다.</p>
        </div>
        <button onClick={goQuestion}>읽던 문서 {doc.page}쪽 시작으로 돌아가기</button>
      </div>

      <p>최신 질문순</p>

      {/* 기록이 없을 때 안내 */}
      {history.length === 0 && <p>아직 질문 기록이 없습니다.</p>}

      {/* 기록 하나하나를 상자로 그림 */}
      {history.map((item) => (
        <div className="box" key={item.id}>
          <h2>문서 {item.page}쪽 · {item.question}</h2>

          <button className="text-btn" onClick={() => toggle(item.id)}>
            {openIds.includes(item.id) ? '답변 내용 접기' : '답변 내용 펼치기'}
          </button>

          {/* 펼쳐져 있을 때만 답변이 보임 */}
          {openIds.includes(item.id) && <p>{item.answer}</p>}

          <div className="right">
            <button onClick={() => alert('문서 화면은 아직 없어요')}>
              문서 {item.page}쪽 본문 시작으로 이동
            </button>
          </div>
        </div>
      ))}

      <footer className="footer">07 / 모두의 페이지</footer>
    </div>
  )
}