import client from "./client";

// 내 문서 목록 조회
export async function getDocuments() {
  const response = await client.get("/documents");
  console.log("문서 목록 응답:", response.data);
  return response.data;
}

// PDF 업로드
export async function uploadDocument(file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await client.post("/documents", formData);
  console.log("문서 업로드 응답:", response.data);
  return response.data;
}

// PDF 텍스트 추출 처리 요청
export async function processDocument(documentId) {
  const response = await client.post(
    `/documents/${documentId}/process`
  );
  console.log("문서 처리 요청 응답:", response.data);
  return response.data;
}

// PDF 텍스트 추출 상태 조회
export async function getDocumentStatus(documentId) {
  const response = await client.get(
    `/documents/${documentId}/status`
  );

  console.log("문서 처리 상태:", response.data);
  return response.data;

  
}

// 문서 1개 정보 조회
export async function getDocument(documentId) {
  const response = await client.get(`/documents/${documentId}`);

  console.log("문서 상세 정보:", response.data);
  return response.data;
}