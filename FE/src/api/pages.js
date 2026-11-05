// ============================================================
// src/api/pages.js
// 역할: 문서의 "쪽별 텍스트/구조화 데이터" 조회
//  - getDocumentPages: 명세서 4-1  GET /documents/{id}/pages
// 응답 형태(명세서 그대로): { document_id, total_pages, pages: [{ page_id, page_number, title, blocks: [...] }] }
// blocks의 type은 heading(소제목) / paragraph(문단) 등
// ============================================================

// [목업] 가짜 문서 24쪽 중 일부 쪽만 만들고, 나머지 쪽은 자동 생성
// [백엔드 연동] 아래 주석 속 실제 코드로 교체. 화면 코드(Reader.jsx)는 수정 불필요.
// 주의: 명세서의 파일명(file_name)은 4-1 응답에 없음 → 백엔드에 "추가 요청" 하거나
//       GET /documents(5-1) 목록에서 찾아 쓰기
export async function getDocumentPages(documentId) {
  await new Promise((resolve) => setTimeout(resolve, 400));

  const total = 24;
  // 직접 작성한 쪽 (시안의 7쪽, 12쪽)
  const handmade = {
    7: {
      title: "세포막의 물질 이동",
      blocks: [
        { type: "heading", content: "단순 확산" },
        { type: "paragraph", content: "물질은 농도가 높은 곳에서 낮은 곳으로 이동합니다." },
        { type: "heading", content: "촉진 확산" },
        { type: "paragraph", content: "막단백질을 통해 이동하며 ATP를 직접 사용하지 않습니다." },
      ],
    },
    12: {
      title: "세포막 전위",
      blocks: [
        { type: "heading", content: "안정막 전위" },
        { type: "paragraph", content: "신경세포가 자극을 받지 않을 때 세포막 안팎에는 전위차가 존재합니다." },
      ],
    },
  };

  const pages = Array.from({ length: total }, (_, i) => {
    const n = i + 1;
    const made = handmade[n];
    return {
      page_id: `mock-page-${n}`,
      page_number: n,
      title: made ? made.title : `문서 ${n}쪽 내용`,
      blocks: (made ? made.blocks : [
        { type: "heading", content: `${n}쪽 소제목` },
        { type: "paragraph", content: `${n}쪽의 예시 본문입니다. 백엔드 연동 후 실제 추출 텍스트로 바뀝니다.` },
      ]).map((b, idx) => ({
        block_id: `mock-block-${n}-${idx + 1}`,
        order: idx + 1,
        bbox: [0, 0, 0, 0],
        ...b,
      })),
    };
  });

  return {
    document_id: documentId,
    file_name: "해부생리학_3주차.pdf", // [명세서에 없음] 목업용
    total_pages: total,
    pages,
  };
}

/* ---------- [백엔드 연동] 실제 코드 ----------
export async function getDocumentPages(documentId) {
  const response = await fetch(`/api/v1/documents/${documentId}/pages`, {
    headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error);
  }
  return response.json();
}
---------------------------------------------- */