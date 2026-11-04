from app.supabase import storage_client, BUCKET_NAME


def upload_pdf(file_path: str, file_bytes: bytes):
    """
    PDF 파일을 Supabase Storage에 업로드
    """

    result = storage_client.storage.from_(BUCKET_NAME).upload(
        path=file_path,
        file=file_bytes,
        file_options={
            "content-type": "application/pdf",
            "upsert": "false"
        }
    )

    return result


def delete_pdf(file_path: str):
    """
    업로드 실패 시 Storage 파일 삭제
    """

    return storage_client.storage.from_(BUCKET_NAME).remove(
        [file_path]
    )