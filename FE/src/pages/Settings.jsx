// ============================================================
// src/pages/Settings.jsx  (화면 1: 학습 방식 선택)
// 역할: 사용자가 "스크린리더 중심 / 확대해서 읽기 / 읽기 편한 화면" 중 하나를 고르고
//       "시작하기"를 누르면 선택값을 저장한 뒤 내 학습 자료실로 이동
// 사용 API: 명세서 3-4 PATCH /users/me/interface (src/api/users.js)
// ============================================================
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { updateInterface } from "../api/users";
import "./Settings.css";

// [수정 가능] 카드에 보이는 문구/아이콘/태그. 문구를 바꿀 땐 이 배열만 수정
// value 값은 명세서 3-4의 interface_type과 반드시 같아야 함 (백엔드와 약속된 값이라 바꾸지 말 것)
const MODES = [
  {
    value: "screen_reader",
    icon: "🔊", // [수정 가능] 시안 아이콘 파일을 받으면 <img>로 교체
    title: "스크린리더 중심",
    subtitle: "음성 안내와 키보드 탐색에 최적화",
    desc: "제목과 본문을 쉽게 탐색하고 읽던 위치로 돌아갈 수 있습니다.",
    tags: ["제목·목차 탐색", "키보드 조작"],
  },
  {
    value: "enlarged_reading",
    icon: "🔍",
    title: "확대해서 읽기",
    subtitle: "큰 글자와 화면으로 보기 편하게",
    desc: "글자와 화면을 확대해 더 크고 또렷하게 읽을 수 있습니다.",
    tags: ["Aa 글자 확대", "화면 확대"],
  },
  {
    value: "comfortable_reading",
    icon: "Aa",
    title: "읽기 편한 화면",
    subtitle: "집중해서 읽기 좋은 구성",
    desc: "글자 크기, 줄 간격, 색상 등을 조절해 눈의 피로를 줄일 수 있습니다.",
    tags: ["줄 간격 조절", "색상(고대비)"],
  },
];

// 브라우저에 선택값을 저장할 때 쓰는 이름표(키)
const STORAGE_KEY = "interface_type";

// 화면을 열 때 이전에 저장한 선택값을 불러옴 (없으면 스크린리더 중심이 기본값)
// [백엔드 연동] 설정 조회 API가 생기면 localStorage 대신 서버에서 값을 받아오도록 변경
function loadSavedMode() {
  try {
    return localStorage.getItem(STORAGE_KEY) || "screen_reader";
  } catch {
    return "screen_reader";
  }
}

export default function Settings() {
  const [selected, setSelected] = useState(loadSavedMode); // 현재 선택된 방식
  const [saving, setSaving] = useState(false); // 저장 요청 중인지 (중복 클릭 방지)
  const [message, setMessage] = useState(""); // 성공 안내 문구 (스크린리더가 읽어줌)
  const [error, setError] = useState(""); // 실패 안내 문구
  const navigate = useNavigate();

  const selectedMode = MODES.find((m) => m.value === selected);

  // "선택한 방식으로 시작하기" 클릭 시 실행
  async function handleStart() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      // [백엔드 연동] 이 함수의 내부는 src/api/users.js에서 목업 → 실제 fetch로 교체.
      // 이 화면 코드는 바꿀 필요 없음.
      await updateInterface(selected);

      // 새로고침해도 선택이 유지되도록 브라우저에도 저장
      // [백엔드 연동] 서버에서 설정 조회가 가능해지면 이 localStorage 저장은 제거 가능
      try {
        localStorage.setItem(STORAGE_KEY, selected);
      } catch {
        // 저장이 막힌 브라우저에서는 건너뜀
      }

      setMessage(`${selectedMode.title} 방식으로 설정했습니다. 내 학습 자료실로 이동합니다.`);
      // 안내 문구가 읽힐 시간을 주기 위해 1.2초 뒤 이동
      setTimeout(() => navigate("/documents"), 1200);
    } catch (e) {
      setError(e.message || "설정 저장에 실패했습니다. 다시 시도해 주세요.");
      setSaving(false);
    }
  }

  return (
    <div className="settings">
      {/* [수정 가능] 화면 제목과 안내 문구 */}
      <h1>나에게 편한 학습 방식을 선택해 주세요</h1>
      <p className="settings__lead">
        학습 방식은 언제든 변경할 수 있으며, 화면 확대와 스크린리더를 함께 사용할 수 있습니다.
      </p>

      {/* 라디오 버튼 그룹: 스크린리더가 "학습 방식 선택, 그룹"이라고 읽어줌 */}
      <fieldset className="mode-group">
        <legend className="visually-hidden">학습 방식 선택</legend>

        {/* MODES 배열의 개수만큼 카드를 반복해서 그림 */}
        {MODES.map((mode) => {
          const isSelected = selected === mode.value;
          return (
            // label로 감싸서 카드 어디를 눌러도 안쪽 라디오가 선택됨
            <label
              key={mode.value}
              className={`mode-card${isSelected ? " mode-card--selected" : ""}`}
            >
              {/* 실제 선택을 담당하는 라디오 버튼 (눈에는 숨기고 스크린리더/키보드는 사용) */}
              <input
                type="radio"
                name="learning-mode"
                value={mode.value}
                checked={isSelected}
                onChange={() => setSelected(mode.value)}
                className="visually-hidden"
              />

              <span className="mode-card__top">
                <span className="mode-card__icon" aria-hidden="true">
                  {mode.icon}
                </span>
                {/* 선택된 카드에만 "✓ 선택됨" 배지 표시 (스크린리더는 라디오가 읽어주므로 숨김) */}
                {isSelected && (
                  <span className="mode-card__badge" aria-hidden="true">
                    ✓ 선택됨
                  </span>
                )}
              </span>

              <span className="mode-card__title">{mode.title}</span>
              <span className="mode-card__subtitle">{mode.subtitle}</span>
              <span className="mode-card__desc">{mode.desc}</span>

              {/* 카드 하단의 기능 태그들 */}
              <span className="mode-card__tags">
                {mode.tags.map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
              </span>
            </label>
          );
        })}
      </fieldset>

      <div className="settings__actions">
        {/* 선택값을 저장하고 자료실로 이동 */}
        <button type="button" className="start-btn" onClick={handleStart} disabled={saving}>
          {saving ? "저장 중..." : "선택한 방식으로 시작하기 →"}
        </button>

        {/* 저장 없이 바로 자료실로 이동 */}
        {/* [수정 가능] "기본 화면"의 기준(어떤 모드가 기본인지)은 팀에서 확정 필요 */}
        <button
          type="button"
          className="link-btn"
          onClick={() => navigate("/documents")}
          disabled={saving}
        >
          기본 화면으로 시작하기
        </button>
      </div>

      {/* 성공 안내: role="status"라서 문구가 바뀌면 스크린리더가 정중하게 읽어줌 */}
      <div role="status" aria-live="polite">
        {message && <p className="result result--ok">{message}</p>}
      </div>
      {/* 실패 안내: role="alert"라서 즉시 읽어줌 */}
      <div role="alert">{error && <p className="result result--error">{error}</p>}</div>
    </div>
  );
}