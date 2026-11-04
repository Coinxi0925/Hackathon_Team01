import uuid
import pymupdf
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

# PDF 다운로드 후 페이지별 텍스트 추출
def process_pdf_background(document_id: str, storage_path: str):
    db = SessionLocal()

    try:
        # Supabase Storage에서 PDF 다운로드
        pdf_bytes = storage_client.storage.from_(BUCKET_NAME).download(
            storage_path
        )

        # PDF 열기
        pdf = pymupdf.open(
            stream=pdf_bytes,
            filetype="pdf"
        )

        total_pages = len(pdf)

        # 기존 페이지 데이터 삭제
        db.execute(
            text("""
                DELETE FROM pages
                WHERE document_id = :document_id
            """),
            {"document_id": document_id}
        )

        # 페이지별 텍스트 추출 및 DB 저장
        for index, page in enumerate(pdf):
            page_number = index + 1

            # 페이지 전체 텍스트 추출
            full_text = page.get_text("text")

            # 첫 번째 줄을 페이지 제목으로 사용
            lines = [
                line.strip()
                for line in full_text.splitlines()
                if line.strip()
            ]

            title = lines[0][:200] if lines else f"페이지 {page_number}"
            
            # db에 삽입
            db.execute(
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
                """),
                {
                    "document_id": document_id,
                    "page_number": page_number,
                    "title": title,
                    "full_text": full_text
                }
            )

        pdf.close()

        # 처리 완료 상태로 변경
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

        db.commit()

        print(f"PDF 처리 완료: {document_id}, 총 {total_pages}페이지")

    except Exception as e:
        db.rollback()

        # 처리 실패 상태로 변경
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
        db.close()
        
#PDF 처리 요청 API

@router.post("/{document_id}/process", status_code=202)
def process_document(
    document_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    # 해당 문서가 현재 사용자 소유인지 확인
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