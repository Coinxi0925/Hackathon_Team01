import client from './client'

// 문서의 특정 쪽 정보를 가져와서 page_id를 찾아요
async function getPageId(docId, pageNumber) {
  const res = await client.get(`/documents/${docId}/pages/${pageNumber}`)

  // 확인용: 응답 모양을 콘솔에 찍어요 (확인 후 지워도 돼요)
  console.log('쪽 정보 응답:', res.data)

  // 응답에 id 또는 page_id가 들어 있다고 가정
  return res.data.id ?? res.data.page_id
}

// 질문 보내고 답변 받기
export async function askQuestion({ docId, page, question }) {
  const pageId = await getPageId(docId, page)

  const res = await client.post(`/pages/${pageId}/questions`, {
    question,
    answer_mode: 'normal',
  })

  // 확인용: 응답 모양을 콘솔에 찍어요 (확인 후 지워도 돼요)
  console.log('질문 응답:', res.data)

  // 응답의 어느 칸이 답변인지 모를 때를 대비해 여러 이름을 시도해요
  const data = res.data
  const answer =
    typeof data === 'string'
      ? data
      : data.answer ?? data.answer_text ?? data.response ?? data.content

  return { id: data.id, answer }
}

// 저장된 질문 목록 가져오기
export async function getSavedQuestions() {
  const res = await client.get('/saved-questions')
  console.log('저장된 질문 응답:', res.data)
  return res.data
}

// 회원가입 요청 함수
export async function registerUser({ email, password }) {
  const res = await client.post('/auth/signup', {
    email,
    password,
  })
  console.log('회원가입 응답:', res.data)
  return res.data
}