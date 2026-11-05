// ============================================================
// src/api/documents.js
// 역할: 문서(PDF) 관련 서버 요청 함수 모음
//  - getDocuments : 내 문서 목록 조회   (명세서 5-1  GET  /documents)
//  - uploadDocument: PDF 업로드         (명세서 3-1  POST /documents)
// 화면 코드(Documents.jsx)는 이 함수들만 부르므로,
// 백엔드 연동 시 이 파일의 함수 내부만 바꾸면 됩니다.
// ============================================================

// [목업] 목록 조회: 서버 없이 가짜 문서 3개를 돌려줌
// [백엔드 연동] 아래 주석 속 실제 코드로 교체.
// 주의: 명세서 5-1 응답에는 document_id, file_name, total_pages, status만 있음.
//       last_read_page(마지막 학습 쪽), last_studied_at(정렬용)은 명세서에 없으므로
//       백엔드에 "추가해 달라"고 요청 필요 (없으면 "아직 읽지 않음"으로만 표시됨)
export async function getDocuments() {
  await new Promise((resolve) => setTimeout(resolve, 400));
  return {
    documents: [
      {
        document_id: "mock-1",
        file_name: "해부생리학_3주차.pdf",
        total_pages: 24,
        status: "completed",
        last_read_page: 7, // [명세서에 없음]
        last_studied_at: "2026-11-04T10:00:00", // [명세서에 없음]
      },
      {
        document_id: "mock-2",
        file_name: "심리학개론_3주차.pdf",
        total_pages: 18,
        status: "completed",
        last_read_page: null,
        last_studied_at: null,
      },
      {
        document_id: "mock-3",
        file_name: "기초통계학_2장.pdf",
        total_pages: 32,
        status: "completed",
        last_read_page: null,
        last_studied_at: null,
      },
    ],
  };
}

/* ---------- [백엔드 연동] getDocuments 실제 코드 ----------
export async function getDocuments() {
  const response = await fetch("/api/v1/documents", {
    headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error);
  }
  return response.json(); // { documents: [...] }
}
----------------------------------------------------------- */

// [목업] 업로드: 1.5초 뒤 가짜 성공 응답
// [백엔드 연동] 아래 주석 속 실제 코드로 교체 (명세서 3-1, multipart/form-data)
export async function uploadDocument(file) {
  await new Promise((resolve) => setTimeout(resolve, 1500));
  return {
    document_id: crypto.randomUUID(),
    file_name: file.name,
    file_url: `storage/path/${file.name}`,
    status: "uploaded",
    message: "PDF 업로드 완료",
  };
}

/* ---------- [백엔드 연동] uploadDocument 실제 코드 ----------
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
------------------------------------------------------------ */