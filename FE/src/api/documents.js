// src/api/documents.js

// 지금은 가짜 응답을 돌려주는 목업 버전
//API 함수 만들기 (src/api/documents.js)
export async function uploadDocument(file) {
  await new Promise((resolve) => setTimeout(resolve, 1500)); // 1.5초 기다리는 척
  return {
    document_id: crypto.randomUUID(),
    file_name: file.name,
    file_url: `storage/path/${file.name}`,
    status: "uploaded",
    message: "PDF 업로드 완료",
  };
}

/* 백엔드가 준비되면 아래처럼 교체 (api명세서 3-1)
export async function uploadDocument(file) {
  const formData = new FormData();
  formData.append("file", file); // 명세서의 필드명 "file"

  const response = await fetch("/api/v1/documents", {
    method: "POST",
    headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
    body: formData, // Content-Type은 직접 적지 않기 (브라우저가 자동 설정)
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error);
  }
  return response.json();
}
*/