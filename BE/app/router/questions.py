import uuid
import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel, Field
from typing import Literal

from app.database import get_db
from app.router.documents import get_current_user
from app.service.gemini import generate_answer


router = APIRouter(prefix="/pages", tags=["Questions"])

question_detail_router = APIRouter(
    prefix="/questions",
    tags=["Questions"]
)

logger = logging.getLogger(__name__)

# 교안에서 확인할 수 없는 질문에 대한 기본 답변
NOT_SUPPORTED_ANSWER = "제공된 페이지 내용에서는 해당 내용을 확인할 수 없습니다."


# 요청 데이터 형식
class QuestionRequest(BaseModel):
    question: str = Field(min_length=1, max_length=1000)
    # 쉬운 설명과 그냥 설명 중에서 고를 수 있게
    answer_mode: Literal["easy", "normal"] = "normal"


# bbox 데이터 형식 보정
def parse_bbox(bbox):

    if bbox is None:
        return None

    if isinstance(bbox, str):
        try:
            return json.loads(bbox)
        except json.JSONDecodeError:
            return None

    return bbox


# ai가 반환한 근거 검증
def validate_sources(gemini_sources, blocks, page_number):

    verified_sources = []

    # 실제 DB 블록을 ID 기준으로 정리
    block_map = {
        str(block["id"]): block
        for block in blocks
    }

    for source in gemini_sources:

        block_id = str(source.get("block_id", ""))
        quote = source.get("quote", "")

        # 실제 존재하는 블록인지 확인
        block = block_map.get(block_id)

        if not block or not isinstance(quote, str) or not quote:
            continue

        original_content = block["content"]

        # 인용문이 실제 원문에 존재하는지 확인
        char_start = original_content.find(quote)

        if char_start == -1:
            continue

        char_end = char_start + len(quote)

        verified_sources.append({
            "page_number": page_number,
            "block_id": block_id,
            "quote": quote,
            "bbox": parse_bbox(block["bbox"]),
            "char_start": char_start,
            "char_end": char_end
        })

    return verified_sources


# 현재 페이지 기반 AI 질문 API
@router.post("/{page_id}/questions", status_code=201)
def create_question(
    page_id: str,
    request: QuestionRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):

    # 1. 페이지 조회 및 소유권 확인
    page = db.execute(
        text("""
            SELECT
                p.id,
                p.page_number
            FROM pages p
            JOIN documents d
                ON p.document_id = d.id
            WHERE p.id = :page_id
              AND d.user_id = :user_id
        """),
        {
            "page_id": page_id,
            "user_id": str(current_user.id)
        }
    ).mappings().first()

    if not page:
        raise HTTPException(
            status_code=404,
            detail="페이지를 찾을 수 없습니다."
        )

    # 2. 해당 페이지의 교안 블록 조회
    blocks = db.execute(
        text("""
            SELECT
                id,
                block_type,
                content,
                block_order,
                bbox
            FROM page_blocks
            WHERE page_id = :page_id
            ORDER BY block_order
        """),
        {
            "page_id": page_id
        }
    ).mappings().all()

    blocks = [dict(block) for block in blocks]
    
    # 2. Gemini에 전달할 교안 내용 확인
    # print("===== 전달된 교안 내용 =====")

    # for block in blocks:
    #     print("ID:", block["id"])
    #     print("TYPE:", block["block_type"])
    #     print("CONTENT:", block["content"])

    # print("===========================")

    # 3. ai 답변 생성
    try:

        if not blocks:
            gemini_result = {
                "answer": NOT_SUPPORTED_ANSWER,
                "supported": False,
                "sources": []
            }

        else:
            gemini_result = generate_answer(
                question=request.question,
                answer_mode=request.answer_mode,
                blocks=blocks
            )
            
            # 4. Gemini 응답 확인
        # print("===== Gemini 응답 =====")
        # print(gemini_result)
        # print("=======================")

            
            

    except Exception:
        logger.exception("Gemini 답변 생성 중 오류 발생")

        raise HTTPException(
            status_code=502,
            detail="AI 답변 생성 중 오류가 발생했습니다."
        )

    # 4. 실제 교안 원문과 근거 대조
    verified_sources = []

    if gemini_result.get("supported"):

        verified_sources = validate_sources(
            gemini_sources=gemini_result.get("sources", []),
            blocks=blocks,
            page_number=page["page_number"]
        )

    # 근거가 하나도 검증되지 않으면 답변을 제공하지 않음
    if not verified_sources:
        answer = NOT_SUPPORTED_ANSWER
        verified_sources = []

    else:
        answer = gemini_result["answer"]

    # 5. 질문과 답변 DB 저장
    question_id = str(uuid.uuid4())

    try:

        saved_question = db.execute(
            text("""
                INSERT INTO questions (
                    id,
                    user_id,
                    page_id,
                    question,
                    answer,
                    answer_mode,
                    sources
                )
                VALUES (
                    :id,
                    :user_id,
                    :page_id,
                    :question,
                    :answer,
                    :answer_mode,
                    CAST(:sources AS JSONB)
                )
                RETURNING id, created_at
            """),
            {
                "id": question_id,
                "user_id": str(current_user.id),
                "page_id": page_id,
                "question": request.question,
                "answer": answer,
                "answer_mode": request.answer_mode,
                "sources": json.dumps(
                    verified_sources,
                    ensure_ascii=False
                )
            }
        ).mappings().first()

        db.commit()

    except Exception:
        db.rollback()

        logger.exception("질문 저장 중 오류 발생")

        raise HTTPException(
            status_code=500,
            detail="질문 저장 중 오류가 발생했습니다."
        )

    # 6. API 응답
    return {
        "question_id": str(saved_question["id"]),
        "page_id": page_id,
        "question": request.question,
        "answer": answer,
        "sources": verified_sources,
        "created_at": saved_question["created_at"]
    }
    

# 질문 및 답변 상세 조회 API
@question_detail_router.get("/{question_id}")
def get_question_detail(
    question_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    # 질문 조회 및 사용자 소유권 확인
    question = db.execute(
        text("""
            SELECT
                id,
                page_id,
                question,
                answer,
                sources
            FROM questions
            WHERE id = :question_id
              AND user_id = :user_id
        """),
        {
            "question_id": question_id,
            "user_id": str(current_user.id)
        }
    ).mappings().first()

    if not question:
        raise HTTPException(
            status_code=404,
            detail="질문을 찾을 수 없습니다."
        )

    # 응답 반환
    return {
        "question_id": str(question["id"]),
        "page_id": str(question["page_id"]),
        "question": question["question"],
        "answer": question["answer"],
        "sources": question["sources"] or []
    }
