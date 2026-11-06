# BE/app/router/saved_questions.py
# 질문/답변 저장 및 과거 질문 검색 — B 담당 (명세서 8, 9)
#   POST   /questions/{question_id}/save
#   GET    /saved-questions
#   GET    /saved-questions/search?q=...&document_id=...
#   DELETE /saved-questions/{saved_id}
#
# 사용하는 테이블 (A가 만든 ERD 기준)
#   questions       : id, user_id, page_id, question, answer, answer_mode, sources, created_at
#   saved_questions : id, user_id, question_id, page_id, block_id, created_at
#   pages           : id, document_id, page_number ...
#   page_blocks     : id, page_id, bbox ...
#   documents       : id, user_id, file_name ...

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db
from app.router.auth import get_current_user

router = APIRouter(tags=["Saved Questions"])


class SaveRequest(BaseModel):
    page_id: UUID
    block_id: Optional[UUID] = None


# 목록·검색에서 같이 쓰는 SELECT
SAVED_SELECT = """
    SELECT s.id          AS saved_id,
           q.id          AS question_id,
           q.question,
           q.answer,
           p.document_id,
           d.file_name,
           s.page_id,
           p.page_number,
           s.block_id,
           b.bbox
    FROM saved_questions s
    JOIN questions        q ON q.id = s.question_id
    JOIN pages            p ON p.id = s.page_id
    JOIN documents        d ON d.id = p.document_id
    LEFT JOIN page_blocks b ON b.id = s.block_id
    WHERE s.user_id = :uid
"""


# ───────── 8-1. 질문 및 답변 저장 ─────────
@router.post("/questions/{question_id}/save", status_code=201)
def save_question(
    question_id: UUID,
    body: SaveRequest,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    uid = str(user.id)
    qid = str(question_id)
    pid = str(body.page_id)
    bid = str(body.block_id) if body.block_id else None

    # 1) 내 질문이 맞는지
    question = db.execute(
        text("SELECT id FROM questions WHERE id = :qid AND user_id = :uid"),
        {"qid": qid, "uid": uid},
    ).first()
    if question is None:
        raise HTTPException(404, "질문을 찾을 수 없습니다.")

    # 2) 페이지가 존재하는지
    page = db.execute(text("SELECT id FROM pages WHERE id = :pid"), {"pid": pid}).first()
    if page is None:
        raise HTTPException(404, "페이지를 찾을 수 없습니다.")

    # 3) block_id 를 보냈다면 그 페이지의 블록이 맞는지
    if bid is not None:
        block = db.execute(
            text("SELECT id FROM page_blocks WHERE id = :bid AND page_id = :pid"),
            {"bid": bid, "pid": pid},
        ).first()
        if block is None:
            raise HTTPException(400, "해당 페이지에 없는 block_id 입니다.")

    # 4) 이미 저장한 질문이면 위치만 갱신, 아니면 새로 저장 (질문당 저장 0~1개)
    existing = db.execute(
        text("SELECT id FROM saved_questions WHERE user_id = :uid AND question_id = :qid"),
        {"uid": uid, "qid": qid},
    ).first()

    if existing:
        row = db.execute(
            text("""
                UPDATE saved_questions
                SET page_id = :pid, block_id = :bid
                WHERE id = :sid
                RETURNING id, question_id, page_id, block_id
            """),
            {"pid": pid, "bid": bid, "sid": str(existing.id)},
        ).mappings().first()
    else:
        row = db.execute(
            text("""
                INSERT INTO saved_questions (user_id, question_id, page_id, block_id)
                VALUES (:uid, :qid, :pid, :bid)
                RETURNING id, question_id, page_id, block_id
            """),
            {"uid": uid, "qid": qid, "pid": pid, "bid": bid},
        ).mappings().first()
    db.commit()

    return {
        "saved_id": row["id"],
        "question_id": row["question_id"],
        "page_id": row["page_id"],
        "block_id": row["block_id"],
        "message": "질문 및 답변 저장 완료",
    }


# ───────── 9-1. 과거 질문 키워드 검색 ─────────
# 주의: /saved-questions/{saved_id} 보다 위에 있어야 해요
@router.get("/saved-questions/search")
def search_saved_questions(
    q: str = Query(..., min_length=1, description="검색 키워드"),
    document_id: Optional[UUID] = Query(None, description="특정 문서 내 검색"),
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sql = SAVED_SELECT + " AND (q.question ILIKE :pattern OR q.answer ILIKE :pattern)"
    params = {"uid": str(user.id), "pattern": f"%{q}%"}

    if document_id is not None:
        sql += " AND p.document_id = :did"
        params["did"] = str(document_id)

    sql += " ORDER BY s.created_at DESC"
    rows = db.execute(text(sql), params).mappings().all()

    return {"keyword": q, "total": len(rows), "results": [dict(r) for r in rows]}


# ───────── 8-2. 저장된 질문/답변 목록 조회 ─────────
@router.get("/saved-questions")
def list_saved_questions(user=Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.execute(
        text(SAVED_SELECT + " ORDER BY s.created_at DESC"),
        {"uid": str(user.id)},
    ).mappings().all()

    # 명세서 8-2 응답에는 file_name, bbox 가 없어서 뺌
    items = [
        {k: v for k, v in dict(r).items() if k not in ("file_name", "bbox")}
        for r in rows
    ]
    return {"total": len(items), "items": items}


# ───────── 8-3. 저장한 질문 삭제 ─────────
@router.delete("/saved-questions/{saved_id}")
def delete_saved_question(
    saved_id: UUID,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    deleted = db.execute(
        text("DELETE FROM saved_questions WHERE id = :sid AND user_id = :uid RETURNING id"),
        {"sid": str(saved_id), "uid": str(user.id)},
    ).first()
    db.commit()

    if deleted is None:
        raise HTTPException(404, "저장 내역을 찾을 수 없습니다.")
    return {"message": "저장 내역 삭제 완료"}
