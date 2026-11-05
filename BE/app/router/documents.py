import uuid
import pymupdf
import re
import json
import statistics

from fastapi import BackgroundTasks
from app.database import SessionLocal
from app.supabase import storage_client, BUCKET_NAME

from pathlib import Path

from fastapi import (
    APIRouter,
    UploadFile,
    File,
    Depends,
    HTTPException
)

from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from sqlalchemy.orm import Session
from sqlalchemy import text

from app.database import get_db
from app.supabase import auth_client
from app.service.storage import upload_pdf, delete_pdf


router = APIRouter(prefix="/documents", tags=["Documents"])

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
    db = SessionLocal()
    pdf = None

    try:
        # 1. Supabase Storage에서 PDF 다운로드
        pdf_bytes = storage_client.storage.from_(BUCKET_NAME).download(
            storage_path
        )

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

        # 실패 상태로 변경
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
    
