// ============================================================
// src/api/users.js
// 역할: 사용자 설정과 관련된 서버 요청 함수 모음
// 명세서 3-4: PATCH /users/me/interface  (인증 필요)
// ============================================================

// [목업] 지금은 서버 없이 0.5초 뒤 가짜 성공 응답을 돌려줌
// [백엔드 연동] 백엔드가 준비되면 이 함수 "전체"를 아래 주석 속 실제 코드로 교체하면 끝.
//               (Settings.jsx 등 화면 코드는 수정 불필요)
export async function updateInterface(interfaceType) {
  await new Promise((resolve) => setTimeout(resolve, 500));
  return {
    message: "선호 인터페이스 설정 완료",
    preferences: { interface_type: interfaceType },
  };
}

/* ---------- [백엔드 연동] 실제 코드 (위 목업 함수를 지우고 이걸 사용) ----------
export async function updateInterface(interfaceType) {
  // 1) 주소: 백엔드 서버 주소와 CORS/프록시 설정이 정해지면 확인 ("/api/v1"만으로 되는지, 전체 주소가 필요한지)
  const response = await fetch("/api/v1/users/me/interface", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      // 2) 토큰: 로그인 기능 연동 후 저장된 access_token 키 이름을 팀과 확인
      Authorization: `Bearer ${localStorage.getItem("access_token")}`,
    },
    // 3) 보내는 값: 명세서 3-4의 필드명 interface_type
    body: JSON.stringify({ interface_type: interfaceType }),
  });

  // 4) 실패 시 명세서의 공통 에러 형식 {"error": "..."} 에서 메시지를 꺼내 화면에 전달
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error);
  }
  return response.json();
}
------------------------------------------------------------------------ */