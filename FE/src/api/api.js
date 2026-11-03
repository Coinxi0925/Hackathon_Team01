// 질문을 보내고 답변을 받는 함수
// 지금은 가짜 답변. 백엔드가 완성되면 이 함수 안만 fetch로 바꾸면 됨
export async function askQuestion({ docId, page, question }) {
  // 가짜 답변 (0.8초 뒤)
  await new Promise((resolve) => setTimeout(resolve, 800))
  return '대~~답 AI 답변은 오류가 있을 수 있습니다.'

  // ↓ 백엔드가 완성되면 위 두 줄을 지우고 이렇게 바꿈 (주소와 형식은 백엔드 팀원에게 확인)
  // const res = await fetch('http://백엔드주소/api/questions', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ docId, page, question }),
  // })
  // const data = await res.json()
  // return data.answer
}