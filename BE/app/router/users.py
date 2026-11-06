# BE/app/router/users.py
# 사용자 인터페이스(학습 방식) 설정 — B 담당
#   GET   /users/me/interface   내 설정 조회  (A 요청으로 추가)
#   PATCH /users/me/interface   내 설정 저장  (명세서 3-4)

from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db
from app.router.auth import get_current_user

router = APIRouter(prefix="/users/me", tags=["Users"])

# 명세서의 '선택 가능한 값' 3개만 허용 (다른 값이면 자동으로 422)
InterfaceType = Literal["screen_reader", "enlarged_reading", "comfortable_reading"]


class InterfaceRequest(BaseModel):
    interface_type: InterfaceType


# ───────── 내 인터페이스 설정 조회 ─────────
@router.get("/interface")
def get_interface(user=Depends(get_current_user), db: Session = Depends(get_db)):
    row = db.execute(
        text("""
            SELECT interface_type, updated_at
            FROM user_interface
            WHERE user_id = :uid
        """),
        {"uid": str(user.id)},
    ).mappings().first()

    # 아직 한 번도 선택하지 않은 사용자 → interface_type: null
    # (FE는 null 이면 '학습 방식 선택' 화면을 보여주면 됨)
    return {
        "preferences": {
            "interface_type": row["interface_type"] if row else None,
            "updated_at": row["updated_at"] if row else None,
        }
    }


# ───────── 내 인터페이스 설정 저장 (명세서 3-4) ─────────
@router.patch("/interface")
def update_interface(
    body: InterfaceRequest,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # user_id 가 PK 라서 ON CONFLICT (user_id) 사용 가능
    row = db.execute(
        text("""
            INSERT INTO user_interface (user_id, interface_type, updated_at)
            VALUES (:uid, :itype, now())
            ON CONFLICT (user_id)
            DO UPDATE SET interface_type = EXCLUDED.interface_type,
                          updated_at     = now()
            RETURNING interface_type
        """),
        {"uid": str(user.id), "itype": body.interface_type},
    ).mappings().first()
    db.commit()

    return {
        "message": "선호 인터페이스 설정 완료",
        "preferences": {"interface_type": row["interface_type"]},
    }
