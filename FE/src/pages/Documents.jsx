// ============================================================
// src/pages/Documents.jsx
// 역할: PDF 업로드 + 내 문서 목록 표시 + 정렬 + 읽기 버튼
// 사용 API:
// getDocuments
// uploadDocument
// processDocument
// getDocumentStatus
// ============================================================

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  getDocuments,
  uploadDocument,
  processDocument,
  getDocumentStatus,
} from "../api/documents";

import "./Documents.css";

// 업로드 용량 제한
const MAX_SIZE_MB = 20;

// PDF 처리 상태 조회 간격 및 최대 횟수
const POLLING_INTERVAL = 1500;
const MAX_ATTEMPTS = 120;

// 정렬 옵션
const SORT_OPTIONS = [
  { value: "recent", label: "최근 학습순" },
  { value: "name", label: "이름순" },
];

// 문서 정렬
function sortDocuments(list, sortKey) {
  const copied = [...list];

  if (sortKey === "name") {
    return copied.sort((a, b) =>
      a.file_name.localeCompare(b.file_name, "ko")
    );
  }

  return copied.sort((a, b) => {
    const timeA = a.last_studied_at
      ? new Date(a.last_studied_at).getTime()
      : 0;

    const timeB = b.last_studied_at
      ? new Date(b.last_studied_at).getTime()
      : 0;

    return timeB - timeA;
  });
}

export default function Documents() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState("recent");

  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  // ============================================================
  // 1. 처음 화면이 열릴 때 문서 목록 조회
  // ============================================================

  useEffect(() => {
    getDocuments()
      .then((data) => {
        setDocuments(data.documents || []);
      })
      .catch((error) => {
        console.error("문서 목록 조회 오류:", error);

        setStatus("error");
        setMessage("문서 목록을 불러오지 못했습니다.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // ============================================================
  // 2. PDF 처리 완료 여부를 반복 조회
  // ============================================================

  async function waitForDocumentComplete(documentId) {
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const result = await getDocumentStatus(documentId);

      console.log(
        `[PDF 처리 상태] ${i + 1}/${MAX_ATTEMPTS}`,
        result
      );

      // PDF 처리 완료
      if (result.status === "completed") {
        return result;
      }

      // PDF 처리 실패
      if (result.status === "failed") {
        throw new Error("PDF 텍스트 추출에 실패했습니다.");
      }

      // 아직 처리 중이면 대기
      await new Promise((resolve) =>
        setTimeout(resolve, POLLING_INTERVAL)
      );
    }

    throw new Error(
      "PDF 처리 시간이 초과되었습니다. 잠시 후 다시 확인해 주세요."
    );
  }

  // ============================================================
  // 3. PDF 업로드 및 텍스트 추출
  // ============================================================

  async function handleFileChange(event) {
    const input = event.target;
    const file = input.files[0];

    if (!file) return;

    // PDF 파일 형식 검사
    if (file.type !== "application/pdf") {
      setStatus("error");
      setMessage("PDF 파일만 업로드할 수 있습니다.");

      input.value = "";
      return;
    }

    // 파일 용량 검사
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setStatus("error");
      setMessage(
        `파일 용량은 ${MAX_SIZE_MB}MB 이하여야 합니다.`
      );

      input.value = "";
      return;
    }

    setStatus("uploading");
    setMessage(`${file.name} 업로드 중입니다.`);

    // catch에서도 사용할 수 있도록 try 바깥에 선언
    let uploadedDocumentId = null;

    try {
      // --------------------------------------------------------
      // ① PDF 업로드
      // POST /documents
      // --------------------------------------------------------

      const uploadResult = await uploadDocument(file);

      uploadedDocumentId = uploadResult.document_id;

      console.log("PDF 업로드 성공:", uploadResult);

      // --------------------------------------------------------
      // ② 문서 목록에 우선 processing 상태로 추가
      // --------------------------------------------------------

      const newDocument = {
        document_id: uploadedDocumentId,
        file_name: uploadResult.file_name || file.name,
        total_pages: null,
        status: "processing",
        last_read_page: null,
        last_block_id: null,
        last_studied_at: null,
      };

      setDocuments((prev) => [
        newDocument,
        ...prev.filter(
          (doc) => doc.document_id !== uploadedDocumentId
        ),
      ]);

      setMessage(
        `${file.name} 업로드 완료! 텍스트를 추출하고 있습니다.`
      );

      // --------------------------------------------------------
      // ③ PDF 텍스트 추출 시작
      // POST /documents/{document_id}/process
      // --------------------------------------------------------

      const processResult = await processDocument(
        uploadedDocumentId
      );

      console.log("PDF 처리 요청 성공:", processResult);

      // --------------------------------------------------------
      // ④ 처리 완료 여부 반복 조회
      // GET /documents/{document_id}/status
      // --------------------------------------------------------

      const completedResult =
        await waitForDocumentComplete(uploadedDocumentId);

      console.log("PDF 텍스트 추출 완료:", completedResult);

      // --------------------------------------------------------
      // ⑤ 문서 목록의 상태를 completed로 변경
      // --------------------------------------------------------

      setDocuments((prev) =>
        prev.map((doc) =>
          doc.document_id === uploadedDocumentId
            ? {
                ...doc,
                status: completedResult.status,
                total_pages: completedResult.total_pages,
              }
            : doc
        )
      );

      setStatus("success");
      setMessage(
        `${file.name} 텍스트 추출이 완료되었습니다. 학습을 시작할 수 있습니다.`
      );

    } catch (error) {
      console.error("PDF 업로드 및 처리 오류:", error);

      // 처리 실패 시 해당 문서 상태 변경
      if (uploadedDocumentId) {
        setDocuments((prev) =>
          prev.map((doc) =>
            doc.document_id === uploadedDocumentId
              ? {
                  ...doc,
                  status: "failed",
                }
              : doc
          )
        );
      }

      setStatus("error");
      setMessage(
        error.response?.data?.detail ||
        error.message ||
        "PDF 업로드 및 처리에 실패했습니다."
      );

    } finally {
      // 같은 파일을 다시 선택할 수 있도록 초기화
      input.value = "";
    }
  }

  // ============================================================
  // 4. 읽기 버튼 클릭 시 학습 화면으로 이동
  // ============================================================

  function handleRead(doc) {
    const startPage = doc.last_read_page ?? 1;

    navigate(
      `/documents/${doc.document_id}/pages/${startPage}`
    );
  }

  // ============================================================
  // 5. 문서 정렬
  // ============================================================

  const sorted = sortDocuments(documents, sortKey);

  // ============================================================
  // 6. 화면 렌더링
  // ============================================================

  return (
    <div className="library">

      {/* 화면 제목 */}
      <h1>내 학습 자료실</h1>

      <p className="library__lead">
        학습할 자료를 업로드하거나, 저장된 자료를 선택해
        학습을 이어가세요.
      </p>

      {/* PDF 업로드 영역 */}
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

        <p className="upload-row__hint">
          PDF 파일을 업로드하여 학습을 시작할 수 있습니다.
        </p>

      </div>

      {/* 업로드 및 처리 결과 안내 */}
      <div
        className={`status status--${status}`}
        role={status === "error" ? "alert" : "status"}
        aria-live="polite"
      >
        {message}
      </div>

      {/* 문서 목록 제목 및 정렬 */}
      <div className="list-head">

        <h2>
          내 학습 자료{" "}
          <span className="list-head__count">
            (총 {documents.length}개)
          </span>
        </h2>

        <div className="sort">

          <label
            htmlFor="sort-select"
            className="visually-hidden"
          >
            정렬 기준
          </label>

          <select
            id="sort-select"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value)}
          >
            {SORT_OPTIONS.map((option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            ))}
          </select>

        </div>
      </div>

      {/* 문서 목록 */}
      {loading ? (

        <p role="status">
          문서 목록을 불러오는 중입니다.
        </p>

      ) : sorted.length === 0 ? (

        <p className="empty">
          아직 업로드한 문서가 없습니다.
          위의 버튼으로 PDF를 업로드해 보세요.
        </p>

      ) : (

        <ul className="doc-list">

          {sorted.map((doc, index) => {

            const hasRecord = Boolean(doc.last_read_page);

            const isReady = doc.status === "completed";

            const startPage = doc.last_read_page ?? 1;

            return (

              <li
                key={doc.document_id}
                className={`doc-row${
                  index === 0 && hasRecord
                    ? " doc-row--highlight"
                    : ""
                }`}
              >

                {/* PDF 아이콘 */}
                <span
                  className="pdf-icon"
                  aria-hidden="true"
                >
                  PDF
                </span>

                {/* 문서 정보 */}
                <div className="doc-row__info">

                  <h3>{doc.file_name}</h3>

                  <p>
                    {doc.total_pages
                      ? `총 ${doc.total_pages}쪽`
                      : "쪽수 확인 중"}

                    <span aria-hidden="true"> · </span>

                    {hasRecord
                      ? `마지막 학습: ${doc.last_read_page}쪽`
                      : "아직 읽지 않음"}

                    {doc.status === "uploaded" &&
                      " · 처리 대기"}

                    {doc.status === "processing" &&
                      " · 텍스트 추출 중"}

                    {doc.status === "failed" &&
                      " · 처리 실패"}

                  </p>

                </div>

                {/* 읽기 버튼 */}
                <button
                  type="button"
                  className={`read-btn${
                    hasRecord
                      ? " read-btn--primary"
                      : ""
                  }`}
                  onClick={() => handleRead(doc)}
                  disabled={!isReady}
                  aria-label={`${doc.file_name} ${startPage}쪽부터 ${
                    hasRecord ? "이어 읽기" : "읽기"
                  }`}
                >
                  ▶ {startPage}쪽부터{" "}
                  {hasRecord ? "이어 읽기" : "읽기"}
                </button>

              </li>

            );

          })}

        </ul>

      )}

    </div>
  );
}