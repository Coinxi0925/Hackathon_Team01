import uuid
import pymupdf
import re
import json
import statistics
import traceback

from pydantic import BaseModel, Field
from typing import Literal
from fastapi import BackgroundTasks
from app.database import SessionLocal
from app.supabase import storage_client, BUCKET_NAME

from pathlib import Path

from fastapi import (
    APIRouter,
    UploadFile,
    File,
    Depends,
    HTTPException,
    Query
)

from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from sqlalchemy.orm import Session
from sqlalchemy import text

from app.database import get_db
from app.supabase import auth_client
from app.service.storage import upload_pdf, delete_pdf


router = APIRouter(prefix="/documents", tags=["Documents"])


# 마지막으로 읽은 위치 요청 모델
class ProgressRequest(BaseModel):
    page_number: int = Field(..., ge=1)
    block_id: str | None = None


security = HTTPBearer()

MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB

# 사용자 인증

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):

    token = credentials.credentials

    try:
        response = auth_client.auth.get_user(token)

        if response.user is None:
            raise HTTPException(
                status_code=401,
                detail="인증되지 않은 사용자입니다."
            )

        return response.user

    except HTTPException:
        raise

    except Exception:
        raise HTTPException(
            status_code=401,
            detail="유효하지 않은 인증 토큰입니다."
        )
# 내 문서 목록 조회 API

@router.get("")
def get_documents(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    documents = db.execute(
        text("""
            SELECT
                id,
                file_name,
                total_pages,
                status,
                last_read_page,
                last_block_id,
                last_studied_at,
                created_at
            FROM documents
            WHERE user_id = :user_id
            ORDER BY created_at DESC
        """),
        {
            "user_id": str(current_user.id)
        }
    ).mappings().all()

    return {
        "documents": [
            {
                "document_id": str(doc["id"]),
                "file_name": doc["file_name"],
                "total_pages": doc["total_pages"],
                "status": doc["status"],
                "last_read_page": doc["last_read_page"],
                "last_block_id": (
                    str(doc["last_block_id"])
                    if doc["last_block_id"] else None
                ),
                "last_studied_at": (
                    doc["last_studied_at"].isoformat()
                    if doc["last_studied_at"] else None
                ),
                "created_at": (
                    doc["created_at"].isoformat()
                    if doc["created_at"] else None
                )
            }
            for doc in documents
        ]
    }
    
# PDF 업로드

@router.post("", status_code=201)
def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):

    # PDF 확장자 확인
    if not file.filename or Path(file.filename).suffix.lower() != ".pdf":
        raise HTTPException(
            status_code=400,
            detail="PDF 파일만 업로드할 수 있습니다."
        )

    # 파일 읽기
    file_bytes = file.file.read()

    # 파일 크기 확인
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="파일 크기는 20MB를 초과할 수 없습니다."
        )

    # 실제 PDF 파일인지 확인
    if not file_bytes.startswith(b"%PDF-"):
        raise HTTPException(
            status_code=400,
            detail="올바른 PDF 파일이 아닙니다."
        )

    # 사용자 ID
    user_id = uuid.UUID(str(current_user.id))

    # 문서 UUID 생성
    document_id = uuid.uuid4()

    # 파일명
    file_name = Path(file.filename).name

    # Storage 경로
    storage_path = f"{user_id}/{document_id}.pdf"
    # storage_path = f"{user_id}/{document_id}/{file_name}"

    uploaded = False

    try:

        # 1. Supabase Storage에 PDF 업로드
        upload_pdf(storage_path, file_bytes)
        uploaded = True

        # 2. PostgreSQL에 문서 정보 저장
        db.execute(
            text("""
                INSERT INTO documents (
                    id,
                    user_id,
                    file_name,
                    storage_path,
                    status
                )
                VALUES (
                    :id,
                    :user_id,
                    :file_name,
                    :storage_path,
                    'uploaded'
                )
            """),
            {
                "id": document_id,
                "user_id": user_id,
                "file_name": file_name,
                "storage_path": storage_path
            }
        )

        db.commit()

        # 3. 응답 반환
        return {
            "document_id": str(document_id),
            "file_name": file_name,
            "file_url": storage_path,
            "status": "uploaded",
            "message": "PDF 업로드 완료"
        }

    except Exception as e:

        db.rollback()

        # DB 저장 실패 시 Storage 파일도 삭제
        if uploaded:
            try:
                delete_pdf(storage_path)
            except Exception:
                pass

        print("PDF 업로드 오류:", str(e))

        raise HTTPException(
            status_code=500,
            detail="PDF 업로드 중 오류가 발생했습니다."
        )

def extract_page_blocks(page):
    page_dict = page.get_text("dict")
    page_height = page.rect.height

    # 1. 표 추출
    
    table_items = []
    table_rects = []

    try:
        found_tables = page.find_tables()

        for table in found_tables.tables:
            rows = table.extract()

            # 셀 데이터 정리
            cleaned_rows = [
                [
                    str(cell).strip() if cell is not None else ""
                    for cell in row
                ]
                for row in rows
            ]

            # 내용이 없는 표는 제외
            if not any(
                any(cell for cell in row)
                for row in cleaned_rows
            ):
                continue

            bbox = [float(v) for v in table.bbox]

            table_rects.append(
                pymupdf.Rect(table.bbox)
            )

            table_items.append({
                "kind": "table",
                "y0": bbox[1],
                "bbox": bbox,
                "content": json.dumps(
                    cleaned_rows,
                    ensure_ascii=False
                )
            })

    except Exception as e:
        print(f"표 추출 오류: {e}")

    # 2. 일반 텍스트 추출
    
    text_items = []
    font_sizes = []

    for block in page_dict["blocks"]:

        if "lines" not in block:
            continue

        for line in block["lines"]:

            spans = [
                span
                for span in line["spans"]
                if span["text"].strip()
            ]

            if not spans:
                continue

            content = "".join(
                span["text"]
                for span in line["spans"]
            ).strip()

            if not content:
                continue

            bbox = pymupdf.Rect(line["bbox"])

            # 페이지 하단 머리말/꼬리말 제거
            # 테스트용 PDF에서는 페이지 하단 35pt 영역에
            # 문서명과 페이지 번호가 있음
            if bbox.y0 >= page_height - 35:
                continue

            # 표 영역에 포함된 텍스트는 중복 저장하지 않음
            if any(
                rect.intersects(bbox)
                for rect in table_rects
            ):
                continue

            sizes = [
                span["size"]
                for span in spans
            ]

            max_size = max(sizes)

            font_sizes.extend(sizes)

            is_bold = any(
                "bold" in span["font"].lower()
                for span in spans
            )

            x0, y0, x1, y1 = line["bbox"]

            text_items.append({
                "kind": "text",
                "content": content,
                "bbox": [
                    float(x0),
                    float(y0),
                    float(x1),
                    float(y1)
                ],
                "x0": float(x0),
                "y0": float(y0),
                "y1": float(y1),
                "font_size": float(max_size),
                "is_bold": is_bold
            })

    # 일반 텍스트의 대표 글자 크기
    average_size = (
        statistics.median(font_sizes)
        if font_sizes
        else 10.5
    )

    # 3. 텍스트와 표를 위에서 아래 순서로 정렬

    items = text_items + table_items

    items.sort(
        key=lambda item: (
            item["y0"],
            item["bbox"][0]
        )
    )

    result = []
    paragraph_lines = []

    # 문단 병합 함수
    
    def flush_paragraph():

        nonlocal paragraph_lines

        if not paragraph_lines:
            return

        content = " ".join(
            item["content"]
            for item in paragraph_lines
        ).strip()

        x0 = min(
            item["bbox"][0]
            for item in paragraph_lines
        )

        y0 = min(
            item["bbox"][1]
            for item in paragraph_lines
        )

        x1 = max(
            item["bbox"][2]
            for item in paragraph_lines
        )

        y1 = max(
            item["bbox"][3]
            for item in paragraph_lines
        )

        result.append({
            "block_type": "paragraph",
            "content": content,
            "bbox": [x0, y0, x1, y1]
        })

        paragraph_lines = []

    # 4. 블록 종류 판별 및 문단 병합
    
    for item in items:

        # 표라면 기존 문단을 끝내고 표 블록 추가
        if item["kind"] == "table":

            flush_paragraph()

            result.append({
                "block_type": "table",
                "content": item["content"],
                "bbox": item["bbox"]
            })

            continue

        content = item["content"]
        size = item["font_size"]

        # 번호가 붙은 제목
        numbered_heading = bool(
            re.match(
                r"^\s*\d+[.)]\s*\S+",
                content
            )
            or re.match(
                r"^\s*[①②③④⑤⑥⑦⑧⑨⑩]\s*\S+",
                content
            )
        )

        # 글머리 기호 또는 문제 번호
        is_list = bool(
            re.match(
                r"^\s*[-•●▪◦*]\s+\S+",
                content
            )
            or re.match(
                r"^\s*문제\s*\d+[.)]\s*\S+",
                content
            )
        )

        # 첫 페이지의 중앙 정렬 부제목 인식
        page_center = page.rect.width / 2

        line_center = (
            item["bbox"][0] + item["bbox"][2]
        ) / 2

        centered_subtitle = (
            item["y0"] < 200
            and abs(line_center - page_center) < 35
            and size >= average_size * 1.03
            and len(content) <= 100
        )

        # 제목 판별
        is_heading = (
            len(content) <= 100
            and (
                size >= average_size * 1.12
                or (
                    item["is_bold"]
                    and size >= average_size * 1.05
                )
                or numbered_heading
                or centered_subtitle
            )
        )

        if is_heading:

            flush_paragraph()

            result.append({
                "block_type": "heading",
                "content": content,
                "bbox": item["bbox"]
            })

        elif is_list:

            flush_paragraph()

            result.append({
                "block_type": "list",
                "content": content,
                "bbox": item["bbox"]
            })

        else:

            # 같은 문단의 다음 줄인지 판단
            if paragraph_lines:

                previous = paragraph_lines[-1]

                vertical_gap = (
                    item["y0"] - previous["y1"]
                )

                same_indent = (
                    abs(
                        item["x0"] - previous["x0"]
                    ) <= 12
                )

                similar_size = (
                    abs(
                        item["font_size"]
                        - previous["font_size"]
                    ) <= 1.5
                )

                should_merge = (
                    -2 <= vertical_gap <= 12
                    and same_indent
                    and similar_size
                )

                if not should_merge:
                    flush_paragraph()

            paragraph_lines.append(item)

    # 마지막 문단 저장
    flush_paragraph()

    # 5. 블록 순서 부여

    for index, block in enumerate(
        result,
        start=1
    ):
        block["block_order"] = index

    return result

# PDF 다운로드 후 페이지별 텍스트 추출
# 실제로 추출한 구조화 데이터를 DB에 저장
def process_pdf_background(document_id: str, storage_path: str):
    print(f"[PDF 처리 시작] document_id: {document_id}")

    db = SessionLocal()
    pdf = None

    try:
        # 1. Supabase Storage에서 PDF 다운로드
        pdf_bytes = storage_client.storage.from_(BUCKET_NAME).download(
            storage_path
        )
        print(f"[PDF 다운로드 성공] 크기: {len(pdf_bytes)} bytes")

        # 2. PDF 열기
        pdf = pymupdf.open(
            stream=pdf_bytes,
            filetype="pdf"
        )

        total_pages = len(pdf)

        # 3. 기존 페이지 삭제
        # page_blocks는 ON DELETE CASCADE로 함께 삭제됨
        db.execute(
            text("""
                DELETE FROM pages
                WHERE document_id = :document_id
            """),
            {"document_id": document_id}
        )

        # 4. 페이지별 데이터 추출
        for index, page in enumerate(pdf):
            page_number = index + 1
            print(f"[페이지 처리 중] {page_number}/{total_pages}")

            # 페이지 전체 텍스트
            full_text = page.get_text("text")

            lines = [
                line.strip()
                for line in full_text.splitlines()
                if line.strip()
            ]

            title = (
                lines[0][:200]
                if lines else f"페이지 {page_number}"
            )

            # 5. 페이지 정보 저장
            '''
            RETURNING id:
            pages에 페이지를 저장하면 DB가 페이지 UUID를 생성
            -> 그 UUID를 받아서 해당 페이지에 속하는 page_blocks를 저장함
            '''

            page_result = db.execute(
                text("""
                    INSERT INTO pages (
                        document_id,
                        page_number,
                        title,
                        full_text
                    )
                    VALUES (
                        :document_id,
                        :page_number,
                        :title,
                        :full_text
                    )
                    RETURNING id
                """),
                {
                    "document_id": document_id,
                    "page_number": page_number,
                    "title": title,
                    "full_text": full_text
                }
            ).mappings().first()

            page_id = page_result["id"]

            # 6. 구조화 데이터 추출
            blocks = extract_page_blocks(page)

            # 7. page_blocks 테이블에 저장
            # CAST는 파이썬에서 좌표 리스트를 JSON 문자열로 변환한 뒤 PostgreSQL의 JSONB 컬럼에 저장하는 방식
            for block in blocks:

                db.execute(
                    text("""
                        INSERT INTO page_blocks
                        (
                            page_id,
                            block_type,
                            content,
                            block_order,
                            bbox
                        )
                        VALUES (
                            :page_id,
                            :block_type,
                            :content,
                            :block_order,
                            CAST(:bbox AS jsonb)
                        )
                    """),
                    {
                        "page_id": page_id,
                        "block_type": block["block_type"],
                        "content": block["content"],
                        "block_order": block["block_order"],
                        "bbox": json.dumps(block["bbox"])
                    }
                )
        print("[PDF 처리 완료] DB 상태 변경 시작")
        # 8. PDF 처리 완료 상태 변경
        db.execute(
            text("""
                UPDATE documents
                SET status = 'completed',
                    total_pages = :total_pages
                WHERE id = :document_id
            """),
            {
                "document_id": document_id,
                "total_pages": total_pages
            }
        )

        # 모든 페이지와 block 저장 완료 후 커밋
        db.commit()

        print(
            f"PDF 처리 완료: {document_id}, "
            f"총 {total_pages}페이지"
        )

    except Exception as e:
        db.rollback()

        print("[PDF 처리 오류 발생]")
        traceback.print_exc()

        db.execute(
            text("""
                UPDATE documents
                SET status = 'failed'
                WHERE id = :document_id
            """),
            {"document_id": document_id}
        )

        db.commit()

        print("PDF 처리 오류:", str(e))

    finally:
        if pdf is not None:
            pdf.close()

        db.close()
        
#PDF 처리 요청 API

@router.post("/{document_id}/process", status_code=202)
def process_document(
    document_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    # 해당 문서가 로그인한 사용자 소유인지 확인
    document = db.execute(
        text("""
            SELECT id, storage_path, status
            FROM documents
            WHERE id = :document_id
              AND user_id = :user_id
        """),
        {
            "document_id": document_id,
            "user_id": str(current_user.id)
        }
    ).mappings().first()

    if not document:
        raise HTTPException(
            status_code=404,
            detail="문서를 찾을 수 없습니다."
        )

    if document["status"] == "processing":
        raise HTTPException(
            status_code=409,
            detail="이미 처리 중인 문서입니다."
        )

    # 상태를 processing으로 변경
    db.execute(
        text("""
            UPDATE documents
            SET status = 'processing'
            WHERE id = :document_id
        """),
        {"document_id": document_id}
    )

    db.commit()

    # 함수 호출하여 백그라운드에서 PDF 처리 시작
    background_tasks.add_task(
        process_pdf_background,
        document_id,
        document["storage_path"]
    )

    return {
        "document_id": document_id,
        "status": "processing",
        "message": "PDF 처리가 시작되었습니다."
    }
    
# PDF 상태 조회 API

@router.get("/{document_id}/status")
def get_document_status(
    document_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    document = db.execute(
        text("""
            SELECT id, status, total_pages
            FROM documents
            WHERE id = :document_id
              AND user_id = :user_id
        """),
        {
            "document_id": document_id,
            "user_id": str(current_user.id)
        }
    ).mappings().first()

    if not document:
        raise HTTPException(
            status_code=404,
            detail="문서를 찾을 수 없습니다."
        )

    return {
        "document_id": str(document["id"]),
        "status": document["status"],
        "total_pages": document["total_pages"]
    }
    
# 페이지별 텍스트 및 구조화 데이터 조회 API

@router.get("/{document_id}/pages")
def get_document_pages(
    document_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    # 문서 조회 및 로그인한 사용자의 문서인지 확인
    document = db.execute(
        text("""
            SELECT
                d.id,
                COUNT(p.id) AS total_pages
            FROM documents d
            LEFT JOIN pages p ON d.id = p.document_id
            WHERE d.id = :document_id
              AND d.user_id = :user_id
            GROUP BY d.id
        """),
        {
            "document_id": document_id,
            "user_id": str(current_user.id)
        }
    ).mappings().first()

    if not document:
        raise HTTPException(
            status_code=404,
            detail="문서를 찾을 수 없습니다."
        )

    # 해당 문서의 페이지 조회
    pages = db.execute(
        text("""
            SELECT id, page_number, title
            FROM pages
            WHERE document_id = :document_id
            ORDER BY page_number
        """),
        {
            "document_id": document_id
        }
    ).mappings().all()

    # 해당 문서의 모든 구조화 데이터 조회 (제목, 문단 등)
    blocks = db.execute(
        text("""
            SELECT
                b.id,
                b.page_id,
                b.block_type,
                b.content,
                b.block_order,
                b.bbox
            FROM page_blocks b
            JOIN pages p ON b.page_id = p.id
            WHERE p.document_id = :document_id
            ORDER BY p.page_number, b.block_order
        """),
        {
            "document_id": document_id
        }
    ).mappings().all()

    # 페이지별로 block 분류하기
    # 가져온 block들을 각 페이지에 맞게 묶는 작업
    # 예를 들어 1페이지에 block이 3개 있다면 1페이지의 blocks 배열 안에 3개가 들어가게 됨
    
    blocks_by_page = {}

    for block in blocks:
        page_id = str(block["page_id"])

        if page_id not in blocks_by_page:
            blocks_by_page[page_id] = []

        blocks_by_page[page_id].append({
            "block_id": str(block["id"]),
            "type": block["block_type"],
            "content": block["content"],
            "order": block["block_order"],
            "bbox": block["bbox"]
        })

    # 최종 응답 생성
    result_pages = []

    for page in pages:
        page_id = str(page["id"])

        result_pages.append({
            "page_id": page_id,
            "page_number": page["page_number"],
            "title": page["title"],
            "blocks": blocks_by_page.get(page_id, [])
        })

    return {
        "document_id": str(document["id"]),
        "total_pages": document["total_pages"],
        "pages": result_pages
    }
    

# 문서 내 제목 및 키워드 검색 API
@router.get("/{document_id}/search")
def search_document(
    document_id: str,
    q: str = Query(..., min_length=1, description="검색 키워드"),
    type: Literal["all", "title", "content"] = Query(
        "all",
        description="검색 범위 (all, title, content)"
    ),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    # 1. 문서 존재 여부 및 소유권 확인
    document = db.execute(
        text("""
            SELECT id
            FROM documents
            WHERE id = :document_id
              AND user_id = :user_id
        """),
        {
            "document_id": document_id,
            "user_id": str(current_user.id)
        }
    ).mappings().first()

    if not document:
        raise HTTPException(
            status_code=404,
            detail="문서를 찾을 수 없습니다."
        )

    # 2. 검색 범위에 따른 SQL 조건 설정
    if type == "title":
        search_condition = """
            p.title ILIKE :keyword
        """

    elif type == "content":
        search_condition = """
            (
                p.full_text ILIKE :keyword
                OR EXISTS (
                    SELECT 1
                    FROM page_blocks pb
                    WHERE pb.page_id = p.id
                      AND pb.content ILIKE :keyword
                )
            )
        """

    else:
        search_condition = """
            (
                p.title ILIKE :keyword
                OR p.full_text ILIKE :keyword
                OR EXISTS (
                    SELECT 1
                    FROM page_blocks pb
                    WHERE pb.page_id = p.id
                      AND pb.content ILIKE :keyword
                )
            )
        """

    # 3. 검색 실행
    results = db.execute(
        text(f"""
            SELECT
                p.id AS page_id,
                p.page_number,
                p.title,
                CASE
                    WHEN p.title ILIKE :keyword THEN TRUE
                    ELSE FALSE
                END AS title_matched,
                CASE
                    WHEN (
                        p.full_text ILIKE :keyword
                        OR EXISTS (
                            SELECT 1
                            FROM page_blocks pb
                            WHERE pb.page_id = p.id
                              AND pb.content ILIKE :keyword
                        )
                    ) THEN TRUE
                    ELSE FALSE
                END AS content_matched
            FROM pages p
            WHERE p.document_id = :document_id
              AND {search_condition}
            ORDER BY p.page_number ASC
        """),
        {
            "document_id": document_id,
            "keyword": f"%{q}%",
        }
    ).mappings().all()

    # 4. 응답 생성
    return {
        "document_id": document_id,
        "keyword": q,
        "type": type,
        "total": len(results),
        "results": [
            {
                "page_id": str(result["page_id"]),
                "page_number": result["page_number"],
                "title": result["title"],
                "matched_in": [
                    field
                    for field, matched in [
                        ("title", result["title_matched"]),
                        ("content", result["content_matched"])
                    ]
                    if matched
                ]
            }
            for result in results
        ]
    }


# 특정 문서 상세 조회 API
# 마지막으로 읽은 위치를 저장만 하면 프론트가 다시 문서를 열었을 때 어디서 읽어야 하는지 알 수 없음
# 추가된 column에 맞춰 마지막 위치도 같이 반환되게 수정
@router.get("/{document_id}")
def get_document_detail(
    document_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    # 문서 조회 및 소유권 확인
    document = db.execute(
        text("""
            SELECT
                id,
                file_name,
                total_pages,
                status,
                last_read_page,
                last_block_id,
                last_studied_at
            FROM documents
            WHERE id = :document_id
              AND user_id = :user_id
        """),
        {
            "document_id": document_id,
            "user_id": str(current_user.id)
        }
    ).mappings().first()

    # 문서가 없거나 본인 소유가 아닌 경우
    if not document:
        raise HTTPException(
            status_code=404,
            detail="문서를 찾을 수 없습니다."
        )

    # 응답 반환
    return {
        "document_id": str(document["id"]),
        "file_name": document["file_name"],
        "total_pages": document["total_pages"],
        "status": document["status"],
        "last_read_page": document["last_read_page"],
        "last_block_id": (
            str(document["last_block_id"])
            if document["last_block_id"] else None
        ),
        "last_studied_at": (
            document["last_studied_at"].isoformat()
            if document["last_studied_at"] else None
    )
    }


# 문서 내 특정 페이지 번호로 페이지 조회 API
@router.get("/{document_id}/pages/{page_number}")
def get_document_page(
    document_id: str,
    page_number: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    # 1. 문서 소유권 확인 및 페이지 조회
    page = db.execute(
        text("""
            SELECT
                p.id,
                p.document_id,
                p.page_number,
                p.title
            FROM pages p
            JOIN documents d
                ON p.document_id = d.id
            WHERE d.id = :document_id
              AND d.user_id = :user_id
              AND p.page_number = :page_number
        """),
        {
            "document_id": document_id,
            "user_id": str(current_user.id),
            "page_number": page_number
        }
    ).mappings().first()

    if not page:
        raise HTTPException(
            status_code=404,
            detail="페이지를 찾을 수 없습니다."
        )

    # 2. 해당 페이지의 블록 조회
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
            "page_id": str(page["id"])
        }
    ).mappings().all()

    # 3. 응답 반환
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


# 마지막으로 읽은 위치 저장 API

@router.patch("/{document_id}/progress")
def update_document_progress(
    document_id: str,
    request: ProgressRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    try:
        # 1. 문서 소유권 및 페이지 존재 여부 확인
        page = db.execute(
            text("""
                SELECT p.id
                FROM pages p
                JOIN documents d ON p.document_id = d.id
                WHERE d.id = :document_id
                  AND d.user_id = :user_id
                  AND p.page_number = :page_number
            """),
            {
                "document_id": document_id,
                "user_id": str(current_user.id),
                "page_number": request.page_number
            }
        ).mappings().first()

        if not page:
            raise HTTPException(
                status_code=404,
                detail="문서 또는 페이지를 찾을 수 없습니다."
            )

        # 2. 블록 ID가 있다면 해당 페이지에 속하는지 확인
        if request.block_id is not None:
            block = db.execute(
                text("""
                    SELECT id
                    FROM page_blocks
                    WHERE id = :block_id
                      AND page_id = :page_id
                """),
                {
                    "block_id": request.block_id,
                    "page_id": str(page["id"])
                }
            ).mappings().first()

            if not block:
                raise HTTPException(
                    status_code=404,
                    detail="해당 페이지의 블록을 찾을 수 없습니다."
                )

        # 3. 마지막으로 읽은 위치 저장
        db.execute(
            text("""
                UPDATE documents
                SET
                    last_read_page = :page_number,
                    last_block_id = :block_id,
                    last_studied_at = NOW()
                WHERE id = :document_id
                  AND user_id = :user_id
            """),
            {
                "page_number": request.page_number,
                "block_id": request.block_id,
                "document_id": document_id,
                "user_id": str(current_user.id)
            }
        )

        db.commit()

        return {
            "message": "마지막으로 읽은 위치가 저장되었습니다.",
            "document_id": document_id,
            "last_read_page": request.page_number,
            "last_block_id": request.block_id
        }

    except HTTPException:
        db.rollback()
        raise

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="읽은 위치 저장 중 오류가 발생했습니다."
        )
