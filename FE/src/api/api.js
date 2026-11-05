// 질문을 보내고 답변을 받는 함수
// 지금은 가짜 답변. 백엔드가 완성되면 이 함수 안만 fetch로 바꾸면 됨 
export async function askQuestion({ docId, page, question }) {
  await new Promise((resolve) => setTimeout(resolve, 800)) // 0.8초 기다리는 척

  return (
    '촉진 확산과 능동 수송은 에너지 사용 여부와 이동하는 물질의 방향이 다릅니다. 촉진 확산은 농도 기울기를 따라 에너지를 사용하지 않고 이동하며, 능동 수송은 에너지를 사용해 농도 기울기를 거슬러 이동할 수 있습니다.\n' +
    'AI 답변은 오류가 있을 수 있습니다.'
  )

  // 백엔드 연결 때 위를 지우고 이렇게 바꿈 (주소는 백엔드 팀원에게 확인)
  // const res = await fetch('http://백엔드주소/api/questions', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ docId, page, question }),
  // })
  // const data = await res.json()
  // return data.answer
}