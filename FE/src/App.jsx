import { useState } from 'react'
import QuestionPage from './pages/question.jsx'      // 질문 화면 (파일명: question.jsx)
import QuestionList from './pages/questionlist.jsx'  // 과거 질문 화면 (파일명: questionlist.jsx)

export default function App() {
  // 지금 보여줄 화면: 'question'(질문) 또는 'history'(과거 질문)
  const [page, setPage] = useState('question')

  // 질문 기록 목록 (두 화면이 같이 써야 해서 여기서 보관)
  const [history, setHistory] = useState([])

  // 지금 보고 있는 문서 정보 (나중에 PDF 업로드 화면에서 이 값을 채워줌)
  const [doc, setDoc] = useState({
    id: 1,                          // 문서 번호 (백엔드가 주는 값)
    name: '[업로드 파일이름.pdf]',     // 업로드한 파일 이름
    topic: '[문서 주제]',       // 문서 주제 (없으면 빈 글자)
    page: '[쪽수]',                        // 현재 쪽수
  })

  // 질문을 보내면 호출됨 -> 기록 맨 앞에 추가 (최신순)
  function addHistory(item) {
    setHistory([item, ...history])
  }

  // 'history'면 과거 질문 화면
  if (page === 'history') {
    return (
      <QuestionList doc={doc} history={history} goQuestion={() => setPage('question')} />
    )
  }

  // 그 외에는 질문 화면
  return (
    <QuestionPage doc={doc}addHistory={addHistory} goHistory={() => setPage('history')} />
  )
}