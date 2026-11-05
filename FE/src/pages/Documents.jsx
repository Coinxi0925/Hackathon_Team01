// ============================================================
// src/pages/Documents.jsx  (화면 2: 내 학습 자료실)
// 역할: PDF 업로드 + 내 문서 목록 표시 + 정렬 + "이어 읽기/읽기" 버튼
// 사용 API: getDocuments(5-1), uploadDocument(3-1)  → src/api/documents.js
// ============================================================
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getDocuments, uploadDocument } from "../api/documents";
import "./Documents.css";

// [수정 가능] 업로드 용량 제한(MB). [백엔드 연동] 백엔드의 실제 최대 용량을 확인해서 맞추기
const MAX_SIZE_MB = 20;

// [수정 가능] 정렬 옵션 (value는 아래 sortDocuments 함수와 연결)
const SORT_OPTIONS = [
  { value: "recent", label: "최근 학습순" },
  { value: "name", label: "이름순" },
];

// 선택한 기준으로 목록을 정렬해서 돌려줌 (원본 배열은 건드리지 않음)
function sortDocuments(list, sortKey) {
  const copied = [...list];
  if (sortKey === "name") {
    return copied.sort((a, b) => a.file_name.localeCompare(b.file_name, "ko"));
  }
  // recent: 최근에 학습한 문서가 위로, 학습 기록 없는 문서는 아래로
  return copied.sort((a, b) => {
    const timeA = a.last_studied_at ? new Date(a.last_studied_at).getTime() : 0;
    const timeB = b.last_studied_at ? new Date(b.last_studied_at).getTime() : 0;
    return timeB - timeA;
  });
}

export default function Documents() {
  const [documents, setDocuments] = useState([]); // 문서 목록
  const [loading, setLoading] = useState(true); // 목록 불러오는 중인지
  const [sortKey, setSortKey] = useState("recent"); // 현재 정렬 기준
  const [status, setStatus] = useState("idle"); // 업로드 상태: idle | uploading | success | error
  const [message, setMessage] = useState(""); // 업로드 결과 안내 문구
  const fileInputRef = useRef(null); // 숨겨진 파일 입력칸을 가리키는 도구
  const navigate = useNavigate();

  // 화면이 처음 열릴 때 한 번만 목록을 불러옴
  // [백엔드 연동] getDocuments 내부만 실제 fetch로 바꾸면 이 코드는 수정 불필요
  useEffect(() => {
    getDocuments()
      .then((data) => setDocuments(data.documents))
      .catch((e) => {
        setStatus("error");
        setMessage(e.message || "문서 목록을 불러오지 못했습니다.");
      })
      .finally(() => setLoading(false));
  }, []);

  // 파일을 고른 직후 실행: 검사 → 업로드 → 목록 맨 앞에 추가
  async function handleFileChange(event) {
    const input = event.target;
    const file = input.files[0];
    if (!file) return; // 선택 취소

    // 검사 1: PDF인지
    if (file.type !== "application/pdf") {
      setStatus("error");
      setMessage("PDF 파일만 업로드할 수 있습니다.");
      input.value = "";
      return;
    }
    // 검사 2: 용량
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setStatus("error");
      setMessage(`파일 용량은 ${MAX_SIZE_MB}MB 이하여야 합니다.`);
      input.value = "";
      return;
    }

    setStatus("uploading");
    setMessage(`${file.name} 업로드 중입니다.`);

    try {
      const result = await uploadDocument(file);
      // 새 문서를 목록에 추가. 쪽수는 텍스트 추출이 끝나야 알 수 있어 null
      // [백엔드 연동] 업로드 직후 POST /documents/{id}/process 호출(3-2) 후
      //               GET /documents/{id}/status 로 완료를 확인(3-3)하는 단계를 여기에 추가 예정
      setDocuments((prev) => [
        {
          document_id: result.document_id,
          file_name: result.file_name,
          total_pages: null,
          status: result.status,
          last_read_page: null,
          last_studied_at: null,
        },
        ...prev,
      ]);
      setStatus("success");
      setMessage(`${file.name} 업로드가 완료되었습니다.`);
    } catch (error) {
      setStatus("error");
      setMessage(error.message || "업로드에 실패했습니다.");
    } finally {
      input.value = ""; // 같은 파일을 다시 고를 수 있게 초기화
    }
  }

  // "이어 읽기 / 읽기" 클릭 시 문서 학습 화면(3번)으로 이동
  // [수정 가능] 3번 화면 라우트(/documents/:id/pages/:pageNumber)는 다음 작업에서 추가됨.
  //             그 전에는 빈 화면이 나오는 게 정상
  function handleRead(doc) {
    const startPage = doc.last_read_page ?? 1;
    navigate(`/documents/${doc.document_id}/pages/${startPage}`);
  }

  const sorted = sortDocuments(documents, sortKey);

  return (
    <div className="library">
      {/* [수정 가능] 화면 제목과 안내 문구 */}
      <h1>내 학습 자료실</h1>
      <p className="library__lead">학습할 자료를 업로드하거나, 저장된 자료를 선택해 학습을 이어가세요.</p>

      {/* 업로드 영역: 진짜 input은 숨기고 파란 버튼이 대신 클릭해 줌 */}
      <div className="upload-row">
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          className="visually-hidden"
          tabIndex={-1}
          aria-hidden="true"
        />
        <button
          type="button"
          className="upload-btn"
          onClick={() => fileInputRef.current.click()}
          disabled={status === "uploading"}
        >
          ↑ PDF 파일 업로드
        </button>
        <p className="upload-row__hint">PDF 파일을 업로드하여 학습을 시작할 수 있습니다.</p>
      </div>

      {/* 업로드 결과 안내: 문구가 바뀌면 스크린리더가 자동으로 읽어줌 (에러는 즉시 읽음) */}
      <div
        className={`status status--${status}`}
        role={status === "error" ? "alert" : "status"}
        aria-live="polite"
      >
        {message}
      </div>

      {/* 목록 제목 + 정렬 */}
      <div className="list-head">
        <h2>
          내 학습 자료 <span className="list-head__count">(총 {documents.length}개)</span>
        </h2>

        <div className="sort">
          <label htmlFor="sort-select" className="visually-hidden">
            정렬 기준
          </label>
          <select
            id="sort-select"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value)}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 문서 목록 */}
      {loading ? (
        <p role="status">문서 목록을 불러오는 중입니다.</p>
      ) : sorted.length === 0 ? (
        <p className="empty">아직 업로드한 문서가 없습니다. 위의 버튼으로 PDF를 업로드해 보세요.</p>
      ) : (
        <ul className="doc-list">
          {sorted.map((doc, index) => {
            const hasRecord = Boolean(doc.last_read_page); // 학습 기록 있는지
            const isReady = doc.status === "completed"; // 텍스트 추출이 끝났는지
            const startPage = doc.last_read_page ?? 1;

            return (
              // 첫 번째 문서이면서 학습 기록이 있으면 강조(시안의 파란 테두리 행)
              <li
                key={doc.document_id}
                className={`doc-row${index === 0 && hasRecord ? " doc-row--highlight" : ""}`}
              >
                {/* PDF 아이콘 (장식이라 스크린리더는 건너뜀) */}
                {/* [수정 가능] 아이콘 이미지 파일을 받으면 <img>로 교체 */}
                <span className="pdf-icon" aria-hidden="true">
                  PDF
                </span>

                <div className="doc-row__info">
                  <h3>{doc.file_name}</h3>
                  <p>
                    {doc.total_pages ? `총 ${doc.total_pages}쪽` : "쪽수 확인 중"}
                    <span aria-hidden="true"> · </span>
                    {hasRecord ? `마지막 학습: ${doc.last_read_page}쪽` : "아직 읽지 않음"}
                    {/* [백엔드 연동] 처리 중/실패 상태 표시 (명세서 3-3 status 값) */}
                    {!isReady && doc.status === "uploaded" && " · 처리 대기"}
                    {doc.status === "processing" && " · 텍스트 추출 중"}
                    {doc.status === "failed" && " · 처리 실패"}
                  </p>
                </div>

                {/* 스크린리더용 이름에 파일명을 포함해 버튼끼리 구분되게 함 */}
                <button
                  type="button"
                  className={`read-btn${hasRecord ? " read-btn--primary" : ""}`}
                  onClick={() => handleRead(doc)}
                  disabled={!isReady}
                  aria-label={`${doc.file_name} ${startPage}쪽부터 ${hasRecord ? "이어 읽기" : "읽기"}`}
                >
                  ▶ {startPage}쪽부터 {hasRecord ? "이어 읽기" : "읽기"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}