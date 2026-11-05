import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_PUBLISHABLE_KEY = os.getenv("SUPABASE_PUBLISHABLE_KEY")
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY")
# 환경변수 확인
if not all([
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SECRET_KEY
]):
    raise ValueError("Supabase 환경변수를 확인해주세요.")

# 사용자 인증용 클라이언트
auth_client = create_client(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
)

# Storage 관리용 클라이언트
storage_client = create_client(
    SUPABASE_URL,
    SUPABASE_SECRET_KEY
)

# Storage 버킷 이름
BUCKET_NAME = "documents"