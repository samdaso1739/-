# 🤖 매일매일 AI 코딩 챌린지 (PWA & LLM 기반 학습 앱)

> **"매일 아침, AI가 배달해 주는 단 하나의 코딩 문제!"** > 본 프로젝트는 최신 웹 기술인 **PWA(Progressive Web App)**와 **Google Gemini API**를 융합하여 만든 모바일 친화적 코딩 학습 플랫폼입니다. 앱스토어 다운로드 없이 링크 하나로 스마트폰에 설치하여 매일 새로운 문제를 풀고 학습 습관을 형성할 수 있습니다.

---

## 👥 팀원 및 역할 분담 (교양 O조)
* **팀장 / 백엔드 & AI 연동:** OOO (파이썬 FastAPI 구축, Gemini API 프롬프트 제어 및 JSON 데이터 파싱 담당)
* **프론트엔드 UI & PWA:** OOO (HTML5/Tailwind CSS 반응형 레이아웃 디자인, PWA 설정 및 서비스 워커 등록 담당)
* **기획 & 프롬프트 엔지니어링:** OOO (학습 시나리오 설계, AI 출제 프롬프트 고도화 및 테스트 담당)
* **자료 제작 & 발표:** OOO (사용자 구동 화면 캡처, PPT 제작 및 프로젝트 성과 발표 담당)

---

## 🛠️ 기술 스택 (Tech Stack)
* **Backend:** Python 3.12, FastAPI, Uvicorn, Pydantic
* **Frontend:** HTML5, JavaScript (Fetch API), Tailwind CSS (반응형 디자인)
* **AI Engine:** Google Gemini 2.5 Flash (`response_mime_type: "application/json"` 구조화 출력 적용)
* **App Deploy:** PWA (Web App Manifest, Service Worker 기술 적용)

---

## 📐 시스템 아키텍처 (작동 원리)

[이미지 삽입 예정: 시스템 구조도]

1. **유저**가 앱(PWA)에 접속하거나 푸시 알림을 확인합니다.
2. **프론트엔드(JS)**가 백엔드 서버에 오늘 날짜의 문제를 요청(`fetch`)합니다.
3. **백엔드(FastAPI)**는 **Gemini API**를 호출하여 난이도가 조절된 파이썬 기초 문제를 실시간으로 생성합니다.
4. AI가 생성한 **JSON 데이터**를 받아 유저의 화면에 맞게 깔끔한 4지선다 UI로 렌더링합니다.
5. 유저가 정답을 맞히면 로컬 기록에 반영되어 **달력(캘린더)**과 **월간 정답률 통계**가 실시간으로 갱신됩니다.

---

## 📺 주요 기능 및 화면 UI

### 1. 반응형 메인 UI (모바일 완벽 지원)
* `meta viewport` 및 Tailwind CSS의 유연한 그리드 시스템을 활용하여 스마트폰, 태블릿, PC 등 어떤 기기에서도 완벽한 비율로 작동합니다.
* 올려주신 체크리스트 프로토타입 기반의 직관적이고 깔끔한 초록색 테마를 적용했습니다.

### 2. 📅 실시간 캘린더 & 통계
* 문제를 푼 날은 초록색(✅), 오답인 날은 빨간색으로 스탬프가 찍혀 이번 달 학습 현황을 시각적으로 한눈에 트래킹할 수 있습니다.

### 3. 📱 PWA 기반 원클릭 설치
* `manifest.json` 설정을 통해 브라우저 주소창을 숨긴 **단독 앱(Standalone)** 형태로 실행됩니다.
* 앱스토어를 거치지 않고 사파리/크롬 브라우저의 "홈 화면에 추가" 기능으로 간편하게 설치합니다.

---

## 🏃‍♂️ 실행 방법 (How to Run)

### 1) 필수 라이브러리 설치
```bash
pip install fastapi uvicorn pydantic google-generativeai
