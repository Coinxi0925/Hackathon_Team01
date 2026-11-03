//업로드 화면 만들기(src/pages/Documents.jsx)

import { useRef, useState } from "react";
import { uploadDocument } from "../api/documents";
import "./Documents.css";

const MAX_SIZE_MB = 20; // 임시값: 백엔드에 확인 필요

// 시안의 "최근 학습한 자료"를 보여주기 위한 임시 데이터
// last_read_page, question_count, note_count는 API 명세서에 아직 없는 필드예요.
const initialDocuments = [
  {
    document_id: "mock-1",
    file_name: "생리학 3주차.pdf",
    total_pages: 40,
    last_read_page: 15,
    question_count: 4,
    note_count: 3,
  },
  {
    document_id: "mock-2",
    file_name: "약품분석학 2주차.pdf",
    total_pages: 20,
    last_read_page: null,
    question_count: 0,
    note_count: 0,
  },
];

export default function Documents() {
  const [documents, setDocuments] = useState(initialDocuments);
  const [status, setStatus] = useState("idle"); // idle | uploading | success | error
  const [message, setMessage] = useState("");
  const fileInputRef = useRef(null);

  function handleBrowseClick() {
    fileInputRef.current.click(); // 숨겨진 파일 입력칸을 대신 클릭
  }

  async function handleFileChange(event) {
    const input = event.target;
    const file = input.files[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      setStatus("error");
      setMessage("PDF 파일만 업로드할 수 있습니다.");
      input.value = "";
      return;
    }

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
      setDocuments((prev) => [
        {
          document_id: result.document_id,
          file_name: result.file_name,
          total_pages: null,
          last_read_page: null,
          question_count: 0,
          note_count: 0,
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

  function handleRead(doc) {
    // TODO: 읽기 화면 라우팅 연결 (fe/reader-page 작업에서)
    console.log("읽기 화면으로 이동:", doc.document_id, doc.last_read_page ?? 1);
  }

  function handleReview(doc) {
    // TODO: 저장된 질문/필기 복습 화면 연결
    console.log("복습 화면으로 이동:", doc.document_id);
  }

  return (
    <main id="main" className="documents">
      <h1>내 강의자료</h1>
      <p className="documents__lead">
        새 PDF를 업로드하거나 이전에 읽던 자료로 돌아갈 수 있어요.
      </p>

      {/* 업로드 카드 */}
      <section className="card" aria-labelledby="upload-title">
        <h2 id="upload-title">새 강의자료 업로드</h2>
        <p className="card__desc">
          텍스트가 포함된 PDF부터 지원합니다. 자료는 페이지별로 정리됩니다.
        </p>

        <input
          ref={fileInputRef}
          id="pdf-upload"
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          className="visually-hidden"
          tabIndex={-1}
        />
        <button
          type="button"
          className="btn btn--primary btn--large"
          onClick={handleBrowseClick}
          disabled={status === "uploading"}
        >
          PDF 파일 찾아보기
        </button>
        <p className="card__hint">
          파일 선택 후 업로드·처리 상태를 텍스트로 안내합니다.
        </p>
      </section>

      {/* 상태 메시지: 스크린리더가 변화를 자동으로 읽어줘요 */}
      <div
        className={`status status--${status}`}
        role={status === "error" ? "alert" : "status"}
        aria-live="polite"
      >
        {message}
      </div>

      {/* 최근 학습한 자료 */}
      <section aria-labelledby="recent-title">
        <h2 id="recent-title">최근 학습한 자료</h2>

        {documents.length === 0 ? (
          <p>아직 업로드한 문서가 없습니다.</p>
        ) : (
          <ul className="doc-list">
            {documents.map((doc) => (
              <li key={doc.document_id} className="card doc-card">
                <h3>{doc.file_name}</h3>
                <p className="doc-card__meta">
                  {doc.total_pages ? `총 ${doc.total_pages}페이지` : "페이지 정보 처리 대기"}
                  {" · "}
                  {doc.last_read_page
                    ? `마지막 읽은 곳: ${doc.last_read_page}페이지`
                    : "학습 기록 없음"}
                </p>
                {(doc.question_count > 0 || doc.note_count > 0) && (
                  <p className="doc-card__meta">
                    저장된 AI 질문 {doc.question_count}개 · 개인 필기 {doc.note_count}개
                  </p>
                )}

                <div className="doc-card__actions">
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => handleRead(doc)}
                    aria-label={`${doc.file_name} ${doc.last_read_page ?? 1}페이지부터 ${
                      doc.last_read_page ? "이어 읽기" : "읽기"
                    }`}
                  >
                    {doc.last_read_page
                      ? `${doc.last_read_page}페이지부터 이어 읽기`
                      : "1페이지부터 읽기"}
                  </button>

                  {doc.question_count > 0 && (
                    <button
                      type="button"
                      className="btn btn--secondary"
                      onClick={() => handleReview(doc)}
                      aria-label={`${doc.file_name} 저장된 질문·필기 복습`}
                    >
                      저장된 질문·필기 복습
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}