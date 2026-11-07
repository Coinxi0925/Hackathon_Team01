# 모두의 페이지

> 모두가 학습 장벽 없이, 원하는 방식으로 공부할 수 있는 접근성 중심 AI 학습 공간

강의자료 PDF를 **제목·문단 단위로 구조화**해 스크린리더와 키보드만으로도 편하게 읽을 수 있게 하고, 읽다가 궁금한 점은 **현재 페이지 내용에 근거한 AI 답변**으로 바로 해결한 뒤 **읽던 위치로 돌아갈 수 있는** 학습 서비스입니다.

<!-- TODO: 메인 화면 스크린샷 -->
<!-- ![메인 화면](docs/images/home.png) -->

---

## 목차

1. [기획 배경](#기획-배경)
2. [주요 기능](#주요-기능)
3. [학습 방식](#학습-방식)
4. [핵심 구현](#핵심-구현)
5. [기술 스택](#기술-스택)
6. [시스템 구조](#시스템-구조)
7. [실행 방법](#실행-방법)
8. [API 목록](#api-목록)
9. [데이터베이스](#데이터베이스)
10. [폴더 구조](#폴더-구조)
11. [팀 소개](#팀-소개)
12. [향후 계획](#향후-계획)

---

## 기획 배경

대학 강의자료는 대부분 PDF로 제공됩니다. 하지만 PDF는 화면에 보이는 모양을 기준으로 만들어진 문서라서,

- 스크린리더로 읽으면 **제목과 본문의 구분 없이** 글자가 순서대로만 읽히고,
- 저시력 학습자는 화면을 확대할수록 **문단을 따라가기 어렵고**,
- 모르는 부분을 질문하러 다른 창으로 이동했다가 **읽던 위치를 잃어버리기** 쉽습니다.

**모두의 페이지**는 PDF를 학습하기 좋은 구조로 바꾸고, 사용자가 자신에게 맞는 방식으로 읽고 질문하고 복습할 수 있도록 돕습니다.

## 주요 기능

| 기능 | 설명 |
| --- | --- |
| 📄 **강의자료 읽기** | PDF를 업로드하면 페이지별로 제목·문단을 구분해 구조화합니다. 목차와 쪽 이동으로 원하는 위치를 바로 찾을 수 있습니다. |
| 💬 **AI에 질문하기** | 현재 페이지 내용을 근거로 Gemini가 답변합니다. |
| 📍 **근거 위치 확인** | 답변에 사용된 원문 문단과 위치(bbox)를 함께 제공해, 원본에서 해당 부분을 확인할 수 있습니다. |
| 🔄 **읽던 위치로 복귀** | 질문 후에도 읽던 페이지로 돌아가 학습을 이어갈 수 있습니다. |
| 📚 **복습하기** | 질문과 답변을 원문 위치와 함께 저장하고, 키워드로 다시 찾아볼 수 있습니다. |
| 🔍 **자료 검색** | 문서 안에서 제목과 본문을 키워드로 검색합니다. |

## 학습 방식

처음 로그인하면 자신에게 맞는 학습 방식을 선택하고, 이후에는 저장된 방식이 유지됩니다.

| 학습 방식 | 대상 | 특징 |
| --- | --- | --- |
| 🔊 **스크린리더 중심** (`screen_reader`) | 화면을 보기 어려운 학습자 | 제목·목차 탐색, 키보드 조작, 상태 변화 음성 안내 |
| 🔍 **확대해서 읽기** (`enlarged_reading`) | 저시력 학습자 | 큰 글자, 화면 확대 |
| Aa **읽기 편한 화면** (`comfortable_reading`) | 읽기에 피로를 느끼는 학습자 | 글자 크기·줄 간격·색상(고대비) 조절 |

## 핵심 구현

### 1. PDF 구조화 (PyMuPDF)

단순 텍스트 추출이 아니라, 문서의 **구조**를 복원합니다.

- 페이지의 글자 크기 **중앙값**을 기준으로, 더 크거나 굵은 줄·번호가 붙은 줄을 **제목(heading)** 으로 판단합니다.
- 글자 크기와 줄 간격이 비슷한 줄을 하나의 **문단(paragraph)** 으로 묶습니다.
- 표 영역을 따로 인식하고, 각 블록의 **원본 좌표(bbox)** 와 **읽는 순서**를 저장합니다.
- 처리는 백그라운드에서 진행되며, `uploaded → processing → completed / failed` 상태로 진행 상황을 확인할 수 있습니다.

### 2. 근거 기반 AI 답변 (Gemini)

AI가 자료에 없는 내용을 지어내지 않도록 여러 단계로 막습니다.

- 현재 페이지의 블록만 AI에 전달하고, **자료에 있는 내용만 근거로 답하도록** 지시합니다.
- 응답을 **JSON 스키마**로 고정해 답변·근거 여부·근거 문장을 구조적으로 받습니다.
- AI가 돌려준 근거 문장이 **실제 문단에 그대로 존재하는지 서버에서 다시 검증**하고, 문단 안의 위치(`char_start`, `char_end`)를 계산합니다.
- 근거를 찾지 못하면 답변을 제공하지 않습니다.
- 자료 안에 들어 있는 명령문은 따르지 않도록 해 **프롬프트 인젝션**을 방지합니다.

### 3. 접근성

- `aria-live`로 업로드·답변 생성 등 상태 변화를 스크린리더에 안내합니다.
- 목차·쪽 이동에 `nav`, `aria-label`, `aria-current`를 사용해 현재 위치를 알 수 있게 했습니다.
- 버튼·입력창·목차를 키보드만으로도 이용할 수 있도록 구성했습니다.

### 4. 인증과 보안

- Supabase Auth(JWT)로 회원가입·로그인을 처리하며, 비밀번호를 자체 DB에 저장하지 않습니다.
- 모든 API는 토큰으로 사용자를 확인하고, **본인의 문서·질문·저장 내역만** 조회·수정할 수 있습니다.
- PDF 업로드 시 확장자, 실제 PDF 여부, 용량(20MB)을 검사합니다.

## 기술 스택

| 구분 | 기술 |
| --- | --- |
| Frontend | React, React Router, Vite |
| Backend | Python, FastAPI, Uvicorn, SQLAlchemy |
| Database | Supabase PostgreSQL |
| Auth / Storage | Supabase Auth (JWT), Supabase Storage |
| PDF 처리 | PyMuPDF |
| AI | Google Gemini API |

## 시스템 구조

```
[사용자 브라우저]
      │  React (Vite)
      ▼
[FastAPI 서버] ──── Supabase Auth     (회원가입 · 로그인 · 토큰 검증)
      │        ──── Supabase Storage  (PDF 원본 저장)
      │        ──── Supabase Postgres (문서 · 페이지 · 블록 · 질문 · 설정)
      │        ──── Gemini API        (페이지 근거 기반 답변 생성)
      ▼
 PyMuPDF 백그라운드 처리 (텍스트 추출 → 제목/문단 구조화 → 위치 저장)
```

## 실행 방법

### 1. 환경 변수

프로젝트 루트(`BE`, `FE`와 같은 위치)에 `.env` 파일을 만듭니다.

```
DATABASE_URL=
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
SUPABASE_JWKS_URL=
GEMINI_API_KEY=
GEMINI_MODEL=
```

### 2. Backend

```bash
cd BE
python -m venv venv

# Windows (PowerShell)
venv\Scripts\Activate.ps1
# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
cd ..

# 프로젝트 루트에서 실행
python -m uvicorn app.main:app --app-dir BE --reload --reload-dir BE/app
```

- API 문서(Swagger): http://127.0.0.1:8000/docs

### 3. Frontend

```bash
cd FE
npm install
npm run dev
```

- 접속: http://localhost:5173

## API 목록

인증이 필요한 API는 `Authorization: Bearer {access_token}` 헤더를 포함합니다.

| 분류 | Method | Endpoint | 설명 |
| --- | --- | --- | --- |
| 인증 | POST | `/auth/signup` | 회원가입 |
| 인증 | POST | `/auth/login` | 로그인 (access token 발급) |
| 인증 | POST | `/auth/logout` | 로그아웃 |
| 인증 | GET | `/auth/me` | 내 정보 조회 |
| 사용자 | GET | `/users/me/interface` | 학습 방식 조회 |
| 사용자 | PATCH | `/users/me/interface` | 학습 방식 설정 |
| 문서 | POST | `/documents` | PDF 업로드 |
| 문서 | POST | `/documents/{document_id}/process` | PDF 구조화 처리 요청 |
| 문서 | PATCH | `/documents/{document_id}/process` | 문서 마지막 학습 위치 저장  |
| 문서 | GET | `/documents/{document_id}/status` | 처리 상태 조회 |
| 문서 | GET | `/documents/{document_id}` | 문서 상세 조회 |
| 문서 | GET | `/documents/{document_id}/pages` | 페이지별 구조화 데이터 조회 |
| 문서 | GET | `/documents/{document_id}/pages/{page_number}` | 쪽 번호로 페이지 조회 |
| 문서 | GET | `/documents/{document_id}/search` | 문서 내 제목·키워드 검색 |
| 페이지 | GET | `/pages/{page_id}` | 페이지 상세 조회 |
| 페이지 | GET | `/pages/{page_id}/blocks/{block_id}` | 원문 문단 위치 조회 |
| 질문 | POST | `/pages/{page_id}/questions` | AI 질문 및 답변 생성 |
| 질문 | GET | `/questions/{question_id}` | 질문·답변 상세 조회 |
| 저장 | POST | `/questions/{question_id}/save` | 질문·답변 및 위치 저장 |
| 저장 | GET | `/saved-questions` | 저장 목록 조회 |
| 저장 | GET | `/saved-questions/search` | 저장 질문 키워드 검색 |
| 저장 | DELETE | `/saved-questions/{saved_id}` | 저장 내역 삭제 |

## 데이터베이스
<img width="500" height="1000" alt="Image" src="https://github.com/user-attachments/assets/2c22b32e-092d-44a0-8bf8-bdf3493d987c" />

| 테이블 | 설명 |
| --- | --- |
| `auth.users` | Supabase Auth 사용자 |
| `user_interface` | 사용자별 학습 방식 |
| `documents` | 업로드한 PDF 문서와 처리 상태 |
| `pages` | 페이지별 제목과 전체 텍스트 |
| `page_blocks` | 제목·문단 블록, 읽는 순서, 원본 좌표(bbox) |
| `questions` | AI 질문·답변과 근거(sources) |
| `saved_questions` | 저장한 질문과 원문 위치 |

## 폴더 구조

```
Hackathon_Team01/
├── BE/
│   ├── app/
│   │   ├── main.py           # FastAPI 앱, CORS, 라우터 등록
│   │   ├── database.py       # 환경 설정, DB 연결
│   │   ├── supabase.py       # Supabase 클라이언트
│   │   ├── router/           # auth, users, documents, pages, questions, saved_questions
│   │   └── service/          # gemini(AI 답변), storage(PDF 저장)
│   └── requirements.txt
└── FE/
    ├── src/
    │   ├── pages/            # Home, Signup, Settings, Documents, Reader, question, questionlist
    │   ├── components/       # Layout, Logo
    │   └── api/              # 백엔드 API 호출
    └── package.json
```

## 팀 소개

| 이름 | 역할 | 담당 |
| --- | --- | --- |
| 원서진 | 기획 · 디자인 | 서비스 기획, 로고·화면 디자인, 발표 |
| 김유진 | Frontend | 홈페이지·로그인, AI 질문·답변, 과거 질문 목록 페이지 구현 |
| 박서희 | Frontend | 회원 가입, 학습 방식 선택, pdf 업로드, pdf 학습공간 페이지 구현 |
| 이연우 | Backend | PDF 업로드·구조화, 문서·페이지 조회·검색, AI 질문·답변 기능 구현 |
| 박윤서 | Backend | 회원 인증(JWT), 학습 방식 설정, 질문 저장·검색 기능 구현 |

## 향후 계획

- 이미지 기반 PDF를 위한 **OCR** 지원
- 표·그림에 대한 **대체 텍스트** 생성
- **음성으로 질문하기**와 답변 음성 출력
- ai에게 질문할 때 쉬운 설명 / 일반 설명 중 선택할 수 있게 구현

## 테스트 영상 
gpt 테스트 영상 
https://drive.google.com/file/d/1VqI2oGVhnUx0eWsBbrB_7ZZjYpSf71Ay/view?usp=sharing

