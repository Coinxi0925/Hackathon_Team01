import uuid
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