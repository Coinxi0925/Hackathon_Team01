import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { uploadDocument } from "../api/documents";
import "./Documents.css";

const MAX_SIZE_MB = 20; // 임시값: 백엔드에 확인 필요

// 가짜 데이터 (last_read_page, question_count, note_count는 API 명세서에 아직 없는 필드)
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
  const navigate = useNavigate();

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
      input.value = "";
    }
  }

  function handleRead(doc) {
    // TODO: 읽기 화면 연결 (fe/reader-page 작업에서)
    console.log("읽기 화면으로 이동:", doc.document_id, doc.last_read_page ?? 1);
  }

  return (
    <div className="documents">
      <h1>내 강의자료</h1>
      <p className="documents__lead">자료를 업로드하고 학습을 이어가세요.</p>

      {/* 업로드 카드 */}
      <section className="card upload-card" aria-labelledby="upload-title">
        <div className="upload-card__icon" aria-hidden="true">
          ↑
        </div>
        <h2 id="upload-title">PDF 강의자료 업로드</h2>
        <p className="upload-card__desc">
          텍스트 추출 가능한 PDF부터 지원합니다. 페이지별로 읽을 수 있는 학습 자료를 생성합니다.
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
          className="btn btn--primary btn--upload"
          onClick={() => fileInputRef.current.click()}
          disabled={status === "uploading"}
        >
          파일 선택
        </button>

        {/* 상태 메시지: 스크린리더가 변화를 자동으로 읽어줘요 */}
        <div
          className={`status status--${status}`}
          role={status === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {message}
        </div>
      </section>

      {/* 최근 학습한 자료 */}
      <h2 className="section-title">최근 학습한 자료</h2>
      <div className="recent">
        <section aria-label="최근 학습한 자료 목록">
          {documents.length === 0 ? (
            <p>아직 업로드한 문서가 없습니다.</p>
          ) : (
            <ul className="doc-list">
              {documents.map((doc) => (
                <li key={doc.document_id} className="card doc-card">
                  <div className="doc-card__thumb" aria-hidden="true">
                    PDF
                  </div>

                  <div className="doc-card__body">
                    <h3>{doc.file_name}</h3>
                    <p className="doc-card__meta">
                      {doc.last_read_page
                        ? `마지막으로 읽은 페이지: ${doc.last_read_page} / ${doc.total_pages}`
                        : `학습 기록 없음${doc.total_pages ? ` · 총 ${doc.total_pages}페이지` : ""}`}
                    </p>

                    <div className="badges">
                      <span className="badge badge--blue">질문 {doc.question_count}개</span>
                      <span className="badge badge--gray">필기 {doc.note_count}개</span>
                    </div>

                    <div className="doc-card__actions">
                      <button
                        type="button"
                        className="btn btn--primary"
                        onClick={() => handleRead(doc)}
                        aria-label={`${doc.file_name} ${doc.last_read_page ?? 1}페이지부터 ${
                          doc.last_read_page ? "이어서 학습하기" : "학습 시작하기"
                        }`}
                      >
                        {doc.last_read_page ? "이어서 학습하기 →" : "학습 시작하기 →"}
                      </button>
                      <button
                        type="button"
                        className="btn btn--secondary"
                        onClick={() => navigate("/review")}
                        aria-label={`${doc.file_name} 복습 목록`}
                      >
                        복습 목록
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 다시 찾아보기 카드 */}
        <aside className="card find-card" aria-labelledby="find-title">
          <h3 id="find-title">다시 찾아보기</h3>
          <p>
            이전에 저장한 질문과 필기는
            <br />
            통합 복습에서 확인할 수 있습니다.
          </p>
          <button
            type="button"
            className="btn btn--outline"
            onClick={() => navigate("/review")}
          >
            통합 복습 열기
          </button>
        </aside>
      </div>
    </div>
  );
}