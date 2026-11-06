# BE/app/router/auth.py
# 회원가입 / 로그인 / 로그아웃 / 사용자 정보 조회 

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from supabase_auth.errors import AuthApiError

from app.supabase import auth_client, storage_client

router = APIRouter(prefix="/auth", tags=["Auth"])

# auto_error=False: 토큰이 없을 때 FastAPI 기본(403) 대신 401을 직접 돌려주려고
security = HTTPBearer(auto_error=False)


# ───────────────────────── 요청 형식 ─────────────────────────

class SignupRequest(BaseModel):
    email: str
    password: str = Field(..., min_length=6, description="6자 이상")


class LoginRequest(BaseModel):
    email: str
    password: str


# ───────────────────────── 공통 함수 ─────────────────────────

def to_user_response(user) -> dict:
    """Supabase 사용자 → {id, email}"""
    return {
        "id": str(user.id),
        "email": user.email,
    }


def get_token(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> str:
    """Authorization: Bearer {access_token} 헤더에서 토큰 문자열만 꺼내요."""
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=401,
            detail="로그인이 필요합니다.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return credentials.credentials


def get_current_user(token: str = Depends(get_token)):
    """토큰을 Supabase에 확인해서 로그인한 사용자를 돌려줘요. (공통 인증 의존성)"""
    try:
        response = auth_client.auth.get_user(token)
    except AuthApiError as exc:
        raise HTTPException(
            status_code=401,
            detail="유효하지 않은 인증 토큰입니다. 다시 로그인해 주세요.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    except Exception as exc:  # 네트워크 문제 등
        raise HTTPException(
            status_code=503,
            detail="인증 서버에 연결할 수 없습니다.",
        ) from exc

    if response is None or response.user is None:
        raise HTTPException(
            status_code=401,
            detail="인증된 사용자를 찾을 수 없습니다.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return response.user


# ───────────────────────── 2-1. 회원가입 ─────────────────────────

@router.post("/signup", status_code=201)
def signup(request: SignupRequest):
    try:
        response = auth_client.auth.sign_up({
            "email": request.email,
            "password": request.password,
        })
    except AuthApiError as exc:
        message = str(exc)
        if "already registered" in message.lower():
            message = "이미 가입된 이메일입니다."
        raise HTTPException(status_code=400, detail=message) from exc

    if response.user is None:
        raise HTTPException(status_code=400, detail="회원가입에 실패했습니다.")

    return {
        "message": "회원가입이 완료되었습니다.",
        "user": to_user_response(response.user),
    }


# ───────────────────────── 2-2. 로그인 ─────────────────────────

@router.post("/login")
def login(request: LoginRequest):
    try:
        response = auth_client.auth.sign_in_with_password({
            "email": request.email,
            "password": request.password,
        })
    except AuthApiError as exc:
        if "not confirmed" in str(exc).lower():
            raise HTTPException(
                status_code=403,
                detail="이메일 인증이 필요한 계정입니다.",
            ) from exc
        raise HTTPException(
            status_code=401,
            detail="이메일 또는 비밀번호가 올바르지 않습니다.",
        ) from exc

    if response.session is None or response.user is None:
        raise HTTPException(status_code=403, detail="이메일 인증이 필요한 계정입니다.")

    session = response.session
    return {
        "access_token": session.access_token,
        "refresh_token": session.refresh_token,
        "token_type": "bearer",
        "expires_in": session.expires_in,
        "user": to_user_response(response.user),
    }


# ───────────────────────── 2-3. 로그아웃 ─────────────────────────

@router.post("/logout")
def logout(token: str = Depends(get_token), user=Depends(get_current_user)):
    try:
        # 현재 세션(이 기기)만 종료. refresh token 이 끊겨서 더 이상 토큰 갱신이 안 돼요.
        storage_client.auth.admin.sign_out(token, scope="local")
    except AuthApiError as exc:
        raise HTTPException(
            status_code=401,
            detail="로그아웃에 실패했습니다. 토큰을 확인해 주세요.",
        ) from exc

    return {"message": "로그아웃이 완료되었습니다."}


# ───────────────────────── 2-4. 사용자 정보 조회 ─────────────────────────

@router.get("/me")
def get_me(user=Depends(get_current_user)):
    return to_user_response(user)