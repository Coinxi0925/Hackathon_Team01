from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.database import get_db
from app.router.documents import get_current_user


router = APIRouter(prefix="/pages", tags=["Pages"])


# 특정 페이지 상세 조회 API

@router.get("/{page_id}")
def get_page_detail(
    page_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    # 페이지 조회 및 소유권 확인
    page = db.execute(
        text("""
            SELECT
                p.id,
                p.document_id,
                p.page_number,
                p.title
            FROM pages p
            JOIN documents d ON p.document_id = d.id
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

    # 해당 페이지의 block 조회
    blocks = db.execute(
        text("""
            SELECT
                id,
                block_type,
                content,
                block_order
            FROM page_blocks
            WHERE page_id = :page_id
            ORDER BY block_order
        """),
        {
            "page_id": page_id
        }
    ).mappings().all()

    # 응답 생성
    return {
        "page_id": str(page["id"]),
        "document_id": str(page["document_id"]),
        "page_number": page["page_number"],
        "title": page["title"],
        "blocks": [
            {
                "block_id": str(block["id"]),
                "type": block["block_type"],
                "content": block["content"],
                "order": block["block_order"]
            }
            for block in blocks
        ]
    }
    
# AI 답변의 근거가 된 원문 블록 위치 조회 API
@router.get("/{page_id}/blocks/{block_id}")
def get_page_block(
    page_id: str,
    block_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    # 블록 조회 및 사용자 소유권 확인
    block = db.execute(
        text("""
            SELECT
                p.id AS page_id,
                p.page_number,
                pb.id AS block_id,
                pb.content,
                pb.bbox,
                pb.block_order
            FROM page_blocks pb
            JOIN pages p
                ON pb.page_id = p.id
            JOIN documents d
                ON p.document_id = d.id
            WHERE p.id = :page_id
              AND pb.id = :block_id
              AND d.user_id = :user_id
        """),
        {
            "page_id": page_id,
            "block_id": block_id,
            "user_id": str(current_user.id)
        }
    ).mappings().first()

    if not block:
        raise HTTPException(
            status_code=404,
            detail="원문 블록을 찾을 수 없습니다."
        )

    # 응답 반환
    return {
        "page_id": str(block["page_id"]),
        "page_number": block["page_number"],
        "block_id": str(block["block_id"]),
        "content": block["content"],
        "bbox": block["bbox"],
        "order": block["block_order"]
    }
