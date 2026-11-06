// ============================================================
// src/api/users.js
// 역할: 사용자 설정 관련 서버 요청 함수
// 명세서 3-4: PATCH /users/me/interface
// ============================================================

import client from "./client";

// 학습 방식 설정 저장
export async function updateInterface(interfaceType) {
  try {
    const res = await client.patch("/users/me/interface", {
      interface_type: interfaceType,
    });

    return res.data;
  } catch (error) {
    console.error("학습 방식 설정 실패:", error.response?.data || error);

    throw new Error(
      error.response?.data?.detail ||
      error.response?.data?.message ||
      "학습 방식 설정에 실패했습니다."
    );
  }
}