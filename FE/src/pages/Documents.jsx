//업로드 화면 만들기(src/pages/Documents.jsx)

import { useState } from "react";
import { uploadDocument } from "../api/documents";

const MAX_SIZE_MB = 20; // 임시값: 백엔드에 확인 필요

export default function Documents() {
  const [documents, setDocuments] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | uploading | success | error
  const [message, setMessage] = useState("");

  async function handleFileChange(event) {
    const file = event.target.files[0]; // 사용자가 고른 첫 번째 파일

    if (!file) return; // 선택 취소한 경우

    // 검사 1: PDF인지
    if (file.type !== "application/pdf") {
      setStatus("error");
      setMessage("PDF 파일만 업로드할 수 있습니다.");
      return;
    }

    // 검사 2: 용량
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setStatus("error");
      setMessage(`파일 용량은 ${MAX_SIZE_MB}MB 이하여야 합니다.`);
      return;
    }

    // 서버로 보내기
    setStatus("uploading");
    setMessage(`${file.name} 업로드 중입니다.`);

    try {
      const result = await uploadDocument(file);
      setDocuments((prev) => [...prev, result]);
      setStatus("success");
      setMessage(`${file.name} 업로드가 완료되었습니다.`);
    } catch (error) {
      setStatus("error");
      setMessage(error.message || "업로드에 실패했습니다.");
    }

    event.target.value = ""; // 같은 파일을 다시 선택할 수 있게 초기화
  }

  return (
    <main id="main">
      <h1>내 문서</h1>

      <label htmlFor="pdf-upload">PDF 파일 선택</label>
      <input
        id="pdf-upload"
        type="file"
        accept="application/pdf"
        onChange={handleFileChange}
        disabled={status === "uploading"}
      />

      <p role="status" aria-live="polite">{message}</p>

      <h2>업로드한 문서</h2>
      {documents.length === 0 ? (
        <p>아직 업로드한 문서가 없습니다.</p>
      ) : (
        <ul>
          {documents.map((doc) => (
            <li key={doc.document_id}>{doc.file_name}</li>
          ))}
        </ul>
      )}
    </main>
  );
}