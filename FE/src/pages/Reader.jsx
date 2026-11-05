// ============================================================
// src/pages/Reader.jsx  (화면 3: 문서 학습)
// 주소: /documents/:id/pages/:pageNumber
// 역할: 한 쪽의 본문(소제목+문단) 표시, 이전/다음/번호 이동, 목차 이동, 질문 버튼 자리
// 사용 API: getDocumentPages(4-1) → src/api/pages.js
// [이번 범위 밖] AI 질문 패널, 읽던 위치 복귀 동작, 과거 질문 화면 (다음 작업)
// ============================================================
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getDocumentPages } from "../api/pages";
import "./Reader.css";

export default function Reader({ onAsk, onHistory }) {
  const { id, pageNumber } = useParams(); // 주소에서 문서ID, 쪽 번호를 꺼냄
  const navigate = useNavigate();
  const current = Number(pageNumber) || 1;

  const [doc, setDoc] = useState(null); // 문서 전체 데이터
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [jumpValue, setJumpValue] = useState(String(current)); // 쪽 번호 입력칸 값
  const [announce, setAnnounce] = useState(""); // 스크린리더에 읽어줄 안내 문구
  const titleRef = useRef(null); // 쪽 제목(h1): 쪽 이동 후 포커스를 보낼 곳

  // 화면이 열릴 때 문서 데이터를 한 번 불러옴
  // [백엔드 연동] getDocumentPages 내부만 바꾸면 수정 불필요
  useEffect(() => {
    getDocumentPages(id)
      .then(setDoc)
      .catch((e) => setError(e.message || "문서를 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, [id]);

  // 쪽이 바뀔 때: 입력칸 갱신 + 제목으로 포커스 이동 + 안내 문구
  // (스크린리더 사용자가 새 쪽의 제목부터 바로 듣도록 하는 접근성 핵심)
  useEffect(() => {
    setJumpValue(String(current));
    if (doc && titleRef.current) {
      titleRef.current.focus();
      setAnnounce(`문서 ${current}쪽으로 이동했습니다.`);
    }
  }, [current, doc]);

  if (loading) return <p role="status">문서를 불러오는 중입니다.</p>;
  if (error) return <p role="alert" className="reader-error">{error}</p>;
  if (!doc) return null;

  const total = doc.total_pages;
  const page = doc.pages.find((p) => p.page_number === current);

  // 쪽 이동 공통 함수 (범위를 벗어나면 안내만 하고 이동 안 함)
  function goTo(n) {
    if (!Number.isInteger(n) || n < 1 || n > total) {
      setAnnounce(`1쪽부터 ${total}쪽 사이의 번호를 입력해 주세요.`);
      return;
    }
    navigate(`/documents/${id}/pages/${n}`);
  }

  // 목차: 각 쪽의 제목을 목록으로 사용
  // [수정 가능] 지금은 7쪽, 12쪽 같은 일부만 보이게 함. 실제 데이터에선 heading 블록 기준으로 바꿔도 됨
  const toc = doc.pages.filter((p) => !p.title.endsWith("내용"));

  return (
    <div className="reader">
      {/* 쪽 이동 결과를 스크린리더에 알려주는 보이지 않는 영역 */}
      <div className="visually-hidden" role="status" aria-live="polite">
        {announce}
      </div>

      <div className="reader__top">
        <Link to="/documents" className="back-link">
          ← 내 학습 자료실로 돌아가기
        </Link>
      </div>

      <div className="reader__layout">
        {/* ---------- 왼쪽: 본문 ---------- */}
        <section aria-labelledby="doc-title">
          <div className="doc-title">
            <span className="pdf-badge" aria-hidden="true">PDF</span>
            <div>
              <p id="doc-title" className="doc-title__name">{doc.file_name}</p>
              <p className="doc-title__sub">문서 {current} / {total}쪽</p>
            </div>
          </div>

          {/* 쪽 이동 */}
          <nav className="pager" aria-label="문서 쪽 이동">
            <button type="button" onClick={() => goTo(current - 1)} disabled={current <= 1}>
              ‹ 이전 문서 쪽
            </button>
            <button type="button" onClick={() => goTo(current + 1)} disabled={current >= total}>
              다음 문서 쪽
            </button>

            <div className="pager__jump">
              <label htmlFor="jump-input">이동할 쪽</label>
              <input
                id="jump-input"
                type="number"
                min="1"
                max={total}
                value={jumpValue}
                onChange={(e) => setJumpValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && goTo(Number(jumpValue))}
              />
              <span>/ 총 {total}쪽</span>
              <button type="button" onClick={() => goTo(Number(jumpValue))}>
                이동
              </button>
            </div>
          </nav>

          {/* 본문. id="main-content": 필요 시 건너뛰기 링크 목적지로 사용 */}
          {page ? (
            <article className="page-body">
              {/* tabIndex=-1: 코드로 포커스를 줄 수 있게 함 */}
              <h1 ref={titleRef} tabIndex={-1}>
                문서 {page.page_number}쪽 · {page.title}
              </h1>

              {/* 블록 종류에 따라 소제목/문단으로 그림 (명세서 4-1의 type) */}
              {page.blocks.map((b) =>
                b.type === "heading" ? (
                  <h2 key={b.block_id} className="block-heading">{b.content}</h2>
                ) : (
                  <p key={b.block_id} className="block-paragraph">{b.content}</p>
                )
              )}
            </article>
          ) : (
            <p role="alert">해당 쪽을 찾을 수 없습니다.</p>
          )}

          <aside className="notice">
            <strong>문서 안내</strong>
            <p>PDF에서 추출한 텍스트입니다. 표·그림·수식 등은 누락되거나 정확하게 표시되지 않을 수 있습니다.</p>
          </aside>
        </section>

        {/* ---------- 오른쪽: 목차 + AI 질문 ---------- */}
        <div className="reader__side">
          {/* [이번 범위 밖] 질문 후에만 나타나는 "질문 전 읽던 위치로 돌아가기" 버튼 자리 */}

          <nav className="card" aria-labelledby="toc-title">
            <h2 id="toc-title">문서 목차</h2>
            <ul className="toc">
              {toc.map((p) => (
                <li key={p.page_id}>
                  <button
                    type="button"
                    className={p.page_number === current ? "toc__item toc__item--active" : "toc__item"}
                    onClick={() => goTo(p.page_number)}
                    aria-current={p.page_number === current ? "page" : undefined}
                  >
                    문서 {p.page_number}쪽 · {p.title}
                    <span aria-hidden="true"> ›</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <section className="card" aria-labelledby="ask-title">
            <h2 id="ask-title">AI에게 질문하기</h2>
            <p>현재 보고 있는 문서 내용을 질문하고, AI 답변을 확인한 뒤 읽던 위치로 돌아올 수 있습니다.</p>

            {/* [백엔드 연동] 다음 작업: 질문 패널 열기 (명세서 6-1 POST /pages/{page_id}/questions) */}
            <button
  type="button"
  className="ask-btn"
  onClick={() =>
    onAsk({
      id: id,
      name: doc.file_name,
      topic: page?.title || "",
      page: current,
    })
  }
>
  문서 {current}쪽에 질문하기
</button>

            {/* [수정 가능] 과거 질문 화면이 생기면 해당 주소로 이동 */}
            
            <button
  type="button"
  className="past-btn"
  onClick={() =>
    onHistory({
      id: id,
      name: doc.file_name,
      topic: page?.title || "",
      page: current,
    })
  }
>
  과거 질문 보기 ›
</button>
          </section>
        </div>
      </div>
    </div>
  );
}