import client from './client'

// 내 문서 목록 조회 (GET /documents)
export async function getDocuments() {
  const res = await client.get('/documents')
  console.log('문서 목록 응답:', res.data)
  return res.data
}

// PDF 업로드 (POST /documents)
export async function uploadDocument(file) {
  const formData = new FormData()
  formData.append('file', file)
  const res = await client.post('/documents', formData)
  console.log('문서 업로드 응답:', res.data)
  return res.data
}

// PDF 텍스트 추출 처리 요청 (POST /documents/{id}/process)
export async function processDocument(documentId) {
  const res = await client.post(`/documents/${documentId}/process`)
  console.log('문서 처리 요청 응답:', res.data)
  return res.data
}

// PDF 텍스트 추출 상태 조회 (GET /documents/{id}/status)
export async function getDocumentStatus(documentId) {
  const res = await client.get(`/documents/${documentId}/status`)
  console.log('문서 처리 상태:', res.data)
  return res.data
}