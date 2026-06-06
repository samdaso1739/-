// 전역 변수 및 상수 설정
const languageTopics = {
  JavaScript: ["클로저(Closure)", "비동기 처리(Promise/Async-Await)", "호이스팅과 스코프 법칙", "배열 고차 함수(map/filter/reduce)", "프로토타입과 클래스 상속", "이벤트 루프와 태스크 큐", "지정 연산자 및 구조분해 할당"],
  Python: ["리스트 컴프리헨션", "데코레이터(Decorator)", "제너레이터와 이터레이터", "딕셔너리 조작 및 매핑", "args 및 kwargs 가변 인자", "메모리 참조 및 깊은/얕은 복사", "예외 처리(try-except-finally)"],
  Java: ["가비지 컬렉션 구조", "인터페이스와 추상 클래스 구현", "스트림 API 활용", "제네릭(Generics) 스펙", "멀티 스레드 및 동기화", "예외 계층 구조(Checked/Unchecked)", "오버라이딩 vs 오버로딩 에지 케이스"],
  "C++": ["포인터 및 참조자 배정 연산", "동적 할당과 스마트 포인터", "가상 함수와 다형성 구조", "STL 컨테이너 복잡도", "템플릿(Template) 메타 프로그래밍", "복사 생성자 및 이동 생성자 법칙", "메모리 누수 원인 분석"],
  TypeScript: ["인터페이스 vs 타입 앨리어스", "제네릭 제약 조건(Extends)", "유니온 타입 및 가드 기법", "유틸리티 타입(Partial/Pick/Omit)", "Enums 와 리터럴 상수 차이", "Mapped Types 생성 기법", "Strict Mode 하에서의 널 체크 프로토콜"]
};

let quizHistory = JSON.parse(localStorage.getItem("quizHistory")) || {};
let geminiApiKey = localStorage.getItem("geminiApiKey") || "";
let selectedLang = localStorage.getItem("selectedLang") || "JavaScript";
let selectedDifficulty = localStorage.getItem("selectedDifficulty") || "보통";

let currentQuizData = null;
let forceNewQuiz = false;
let currentCalendarDate = new Date();

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
const todayDateStr = getLocalDateString();

let isQuizLoading = false; 
let activeModalDateStr = null;

// DOM 로드 완료 후 기본 값 설정 및 이벤트 바인딩
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("apiKeyInput").value = geminiApiKey;
  document.getElementById("langSelect").value = selectedLang;
  document.getElementById("difficultySelect").value = selectedDifficulty;

  // 메인 통합 모달의 메모장 이벤트 리스너 연결
  const saveNotesBtn = document.getElementById("saveNotesBtn");
  if (saveNotesBtn) {
    saveNotesBtn.addEventListener("click", saveMainModalNotes);
  }

  initCalendar();
  calculateStats();

  // 오늘 이미 진행한 데이터가 있으면 뷰 렌더링
  if (quizHistory[todayDateStr]) {
    const todayData = quizHistory[todayDateStr];
    const lastIdx = todayData.details ? todayData.details.length - 1 : null;
    const savedDiff = lastIdx !== null ? todayData.details[lastIdx].difficulty : todayData.difficulty;
    const savedConcept = lastIdx !== null ? todayData.details[lastIdx].concept : (todayData.concept || "기타");
    renderQuizResultView(todayData.success, todayData.question, todayData.explanation, todayData.answer, todayData.options, savedDiff || "보통", savedConcept);
  }
});

// 공통 아코디언 토글 제어 함수
function toggleSection(headerElement, contentId) {
  const content = document.getElementById(contentId);
  const icon = headerElement.querySelector('.toggle-icon');
  
  if (content.classList.contains('collapsed')) {
    content.classList.remove('collapsed');
    icon.textContent = '▲ 접기';
  } else {
    content.classList.add('collapsed');
    icon.textContent = '▼ 펼치기';
  }
}

// Prism.js 하이라이트 안전 처리
function safeHighlightAll() {
  if (typeof Prism !== 'undefined') {
    Prism.highlightAll();
  }
}

function getPrismLangClass(lang) {
  const map = { "JavaScript": "javascript", "Python": "python", "Java": "java", "C++": "cpp", "TypeScript": "typescript" };
  return map[lang] || "javascript";
}

function getDifficultyClass(diff) {
  if (diff === "쉬움") return "diff-easy";
  if (diff === "어려움") return "diff-hard";
  return "diff-medium"; 
}

// 초기화 / 세팅 저장 기능
function resetTodayQuiz() {
  if (quizHistory[todayDateStr]) {
    delete quizHistory[todayDateStr];
    localStorage.setItem("quizHistory", JSON.stringify(quizHistory));
    alert("오늘의 기록이 리셋되었습니다.");
    location.reload(); 
  } else {
    alert("오늘 풀이한 기록이 없습니다.");
  }
}

function saveApiKey() {
  const key = document.getElementById("apiKeyInput").value.trim();
  if (!key) { alert("올바른 API 키를 입력해주세요."); return; }
  localStorage.setItem("geminiApiKey", key);
  geminiApiKey = key;
  alert("API 키가 저장되었습니다.");
}

function saveLanguage() {
  selectedLang = document.getElementById("langSelect").value;
  localStorage.setItem("selectedLang", selectedLang);
}

function saveDifficulty() {
  selectedDifficulty = document.getElementById("difficultySelect").value;
  localStorage.setItem("selectedDifficulty", selectedDifficulty);
}

// Gemini API 퀴즈 통신 구문
async function fetchTodayQuiz() {
  if (!geminiApiKey) { alert("먼저 Gemini API 키를 등록하고 저장해주세요!"); return; }
  if (isQuizLoading) return;

  if (!forceNewQuiz && quizHistory[todayDateStr]) {
    const lastIdx = quizHistory[todayDateStr].details ? quizHistory[todayDateStr].details.length - 1 : null;
    const currentDiff = lastIdx !== null ? quizHistory[todayDateStr].details[lastIdx].difficulty : quizHistory[todayDateStr].difficulty;
    const currentConcept = lastIdx !== null ? quizHistory[todayDateStr].details[lastIdx].concept : (quizHistory[todayDateStr].concept || "일반");
    renderQuizResultView(quizHistory[todayDateStr].success, quizHistory[todayDateStr].question, quizHistory[todayDateStr].explanation, quizHistory[todayDateStr].answer, quizHistory[todayDateStr].options, currentDiff || "보통", currentConcept);
    return;
  }

  const quizContentDiv = document.getElementById("quizContent");
  quizContentDiv.innerHTML = `<p style='text-align:center;'>🤖 Gemini가 문제를 엄선하는 중입니다... (중복 요청 금지)</p>`;

  isQuizLoading = true;

  const currentList = languageTopics[selectedLang] || languageTopics["JavaScript"];
  const chosenTopic = currentList[Math.floor(Math.random() * currentList.length)];

  let difficultyGuideline = "";
  if (selectedDifficulty === "쉬움") {
    difficultyGuideline = `
    - 난이도 수준: 기초 문법 활용 및 단순 출력 결과 예측
    - 문제 스타일: 코드의 실행 결과(Output)를 맞추거나, 올바른 문법 표현식을 고르는 단답형/객관식 스타일`;
  } else if (selectedDifficulty === "보통") {
    difficultyGuideline = `
    - 난이도 수준: 알고리즘 기초, 실무 응용, 예외 처리 활용
    - 문제 스타일: 주어진 알고리즘 함수가 특정 입력값을 받았을 때의 리턴값 예측, 혹은 코드 내 빈칸(Blank)에 들어갈 올바른 로직 선택 스타일`;
  } else if (selectedDifficulty === "어려움") {
    difficultyGuideline = `
    - 난이도 수준: 심화 자료구조, 시간/공간 복잡도 최적화, 비동기/메모리 에지 케이스
    - 문제 스타일: 소스 코드의 성능 저하 원인(메모리 누수, 무한 루프 등) 분석, 대규모 데이터 처리 시의 올바른 최적화 기법, 혹은 복잡한 구조의 실행 순서 예측 스타일`;
  }

  const prompt = `당신은 대기업 및 빅테크 기업의 코딩 테스트 전문 출제위원입니다.
단순히 "개념의 정의"를 묻는 말장난 문제(예: 클로저란 무엇인가?)는 절대 출제하지 마십시오.
반드시 실전 변별력이 있는 '소스 코드 분석형' 또는 '구현형 알고리즘' 문제를 딱 1개만 출제해 주세요.

[출제 필수 조건]
- 대상 프로그래밍 언어: ${selectedLang}
- 반드시 반영해야 할 세부 주제: **[${chosenTopic}]** (이 주제가 소스 코드의 핵심 로직이나 문제의 핵심 원인으로 작동해야 합니다.)
- 요구 난이도 및 스타일 가이드: ${difficultyGuideline}

[출제 요구사항]
1. 문제 내용("question")에는 분석해야 할 구체적인 소스 코드가 반드시 포함되어야 합니다. 코드는 백틱 3개(\`\`\`)로 감싸서 표현하세요.
2. 선지("options")는 개념적 설명이 아닌, 코드의 결과값 또는 빈칸에 들어갈 소스 코드 조각 등으로 구성하여 실전 느낌을 내세요.
3. 정답 인덱스(answer) 검산을 철저히 실행해 오류가 없도록 하십시오. (0, 1, 2, 3 중 하나)
4. "concept" 필드에는 해당 세부 주제 이름인 "${chosenTopic}"을 그대로 넣어주세요.

{
  "question": "주어진 세부 주제를 활용한 실전 코딩 테스트 문제 설명과 소스 코드 영역입니다.",
  "options": ["1번 선지", "2번 선지", "3번 선지", "4번 선지"],
  "answer": 0,
  "explanation": "이 코드가 왜 그렇게 동작하는지, 오답 선지들은 왜 틀렸는지에 대한 구체적인 라인별 코드 분석 해설을 작성하세요.",
  "concept": "${chosenTopic}"
}`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    if (!response.ok) { throw new Error(`HTTP 에러: ${response.status}`); }
    const data = await response.json();
    let rawText = data.candidates[0].content.parts[0].text.trim();
    
    const quizData = JSON.parse(rawText);
    if(!quizData.concept) quizData.concept = chosenTopic;
    
    currentQuizData = quizData; 
    renderQuiz(quizData);
  } catch (error) {
    console.error(error);
    let errorMsg = error.message;
    if (errorMsg.includes("429")) {
      errorMsg = "Gemini API의 요청 제한(RPM)을 초과했습니다. 약 1분 뒤에 다시 시도해 주세요.";
    }
    quizContentDiv.innerHTML = `
      <p style='color:red; text-align:center;'>문제를 불러오지 못했습니다.<br><small>${errorMsg}</small></p>
      <button onclick="fetchTodayQuiz()" style="width: 100%; background-color: #3182ce; margin-top: 10px;">다시 시도</button>
    `;
  } finally {
    isQuizLoading = false;
  }
}

// 마크다운 백틱 및 코드 구문 하이라이트 치환 함수
function formatQuestionText(text) {
  if (!text) return "";
  const parts = text.split("```");
  let resultHtml = "";
  
  parts.forEach((part, index) => {
    if (index % 2 === 1) {
      let cleanCode = part.replace(/^(javascript|python|java|cpp|typescript|c)\s*/i, "");
      cleanCode = cleanCode.replace(/</g, "&lt;").replace(/>/g, "&gt;").trim();
      const langClass = getPrismLangClass(selectedLang);
      resultHtml += `<pre><code class="language-${langClass}">${cleanCode}</code></pre>`;
    } else {
      const safeText = part.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      resultHtml += `<span>${safeText}</span>`;
    }
  });
  return resultHtml;
}

// 퀴즈 선택 화면 그리기
function renderQuiz(quizData) {
  const quizContentDiv = document.getElementById("quizContent");
  let optionsHtml = quizData.options.map((opt, idx) => `
    <button class="quiz-opt-btn" onclick="submitAnswer(${idx})">
      ${idx + 1}. ${opt.replace(/</g, "&lt;").replace(/>/g, "&gt;")}
    </button>
  `).join('');

  quizContentDiv.innerHTML = `
    <div style="margin-bottom: 10px; display:flex; gap:5px; align-items:center;">
      <span class="badge-lang">${selectedLang}</span>
      <span class="difficulty-badge ${getDifficultyClass(selectedDifficulty)}">[${selectedDifficulty}]</span>
      <span class="badge-concept">💡 ${quizData.concept}</span>
    </div>
    <div class="quiz-question">${formatQuestionText(quizData.question)}</div>
    <div class="quiz-options">${optionsHtml}</div>
  `;
  
  safeHighlightAll();
}

// 답안 제출 이벤트 처리
function submitAnswer(chosenIdx) {
  if (!currentQuizData) return;

  const correctIdx = currentQuizData.answer;
  const questionText = currentQuizData.question;
  const explanationText = currentQuizData.explanation || "해설이 누락되었습니다.";
  const optionsData = currentQuizData.options;
  const conceptText = currentQuizData.concept || "기타";
  const isSuccess = (chosenIdx === correctIdx);
  
  if (quizHistory[todayDateStr] && forceNewQuiz) {
    if (quizHistory[todayDateStr].totalCount === undefined) {
      const prevSuccess = quizHistory[todayDateStr].success;
      quizHistory[todayDateStr].totalCount = 1;
      quizHistory[todayDateStr].correctCount = prevSuccess ? 1 : 0;
      quizHistory[todayDateStr].details = [{ 
        success: prevSuccess, 
        question: quizHistory[todayDateStr].question, 
        explanation: quizHistory[todayDateStr].explanation, 
        answer: quizHistory[todayDateStr].answer, 
        options: quizHistory[todayDateStr].options,
        language: quizHistory[todayDateStr].language || selectedLang,
        difficulty: quizHistory[todayDateStr].difficulty || "보통",
        concept: quizHistory[todayDateStr].concept || "기타",
        isReviewed: quizHistory[todayDateStr].isReviewed || false,
        isSaved: quizHistory[todayDateStr].isSaved || false 
      }];
    }
    
    quizHistory[todayDateStr].totalCount += 1;
    if (isSuccess) quizHistory[todayDateStr].correctCount += 1;
    quizHistory[todayDateStr].success = (quizHistory[todayDateStr].correctCount === quizHistory[todayDateStr].totalCount);
    quizHistory[todayDateStr].question = questionText;
    quizHistory[todayDateStr].explanation = explanationText;
    quizHistory[todayDateStr].answer = correctIdx;
    quizHistory[todayDateStr].options = optionsData;
    quizHistory[todayDateStr].language = selectedLang;
    quizHistory[todayDateStr].difficulty = selectedDifficulty;
    quizHistory[todayDateStr].concept = conceptText;
    quizHistory[todayDateStr].details.push({ 
      success: isSuccess, 
      question: questionText, 
      explanation: explanationText, 
      answer: correctIdx, 
      options: optionsData, 
      language: selectedLang,
      difficulty: selectedDifficulty,
      concept: conceptText,
      isReviewed: false, 
      isSaved: false 
    });
  } else {
    quizHistory[todayDateStr] = {
      question: questionText,
      success: isSuccess,
      explanation: explanationText,
      answer: correctIdx,
      options: optionsData,
      language: selectedLang,
      difficulty: selectedDifficulty,
      concept: conceptText,
      totalCount: 1,
      correctCount: isSuccess ? 1 : 0,
      customNotes: quizHistory[todayDateStr]?.customNotes || "",
      details: [{ 
        success: isSuccess, 
        question: questionText, 
        explanation: explanationText, 
        answer: correctIdx, 
        options: optionsData, 
        language: selectedLang,
        difficulty: selectedDifficulty,
        concept: conceptText,
        isReviewed: false, 
        isSaved: false 
      }]
    };
  }

  localStorage.setItem("quizHistory", JSON.stringify(quizHistory));
  alert(isSuccess ? "🎉 정답입니다! 훌륭해요." : `❌ 아쉽게도 틀렸습니다! (정답은 ${correctIdx + 1}번)`);

  forceNewQuiz = false;
  renderQuizResultView(isSuccess, questionText, explanationText, correctIdx, optionsData, selectedDifficulty, conceptText);
  initCalendar();
  calculateStats();
}

// 결과 분석 단락 그리기
function renderQuizResultView(isSuccess, questionText, explanationText, correctIdx, optionsData, diffValue, conceptValue) {
  const quizContentDiv = document.getElementById("quizContent");
  let daySummaryHtml = "";
  const todayData = quizHistory[todayDateStr];
  
  let lastIndex = 0;
  let isSaved = false;
  if (todayData && todayData.details) {
    lastIndex = todayData.details.length - 1;
    isSaved = todayData.details[lastIndex]?.isSaved || false;
  }

  if (todayData && todayData.totalCount > 1) {
    daySummaryHtml = `<p style="font-size:14px; color:#4a5568; text-align:center;">(오늘 총 <strong>${todayData.totalCount}문제</strong> 중 <strong>${todayData.correctCount}문제</strong> 성공!)</p>`;
  }

  let answerDisplayString = "?";
  if (correctIdx !== undefined && optionsData && optionsData[correctIdx]) {
    answerDisplayString = `${correctIdx + 1}번 — "${optionsData[correctIdx].replace(/</g, "&lt;").replace(/>/g, "&gt;")}"`;
  } else if (correctIdx !== undefined) {
    answerDisplayString = `${correctIdx + 1}번`;
  }

  const activeDiff = diffValue || "보통";
  const diffClass = getDifficultyClass(activeDiff);
  const activeConcept = conceptValue || "기초 문법";

  quizContentDiv.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:5px;">
      <div style="display:flex; gap:5px; align-items:center; flex-wrap:wrap;">
        <span class="difficulty-badge ${diffClass}">[${activeDiff}]</span>
        <span class="badge-concept">💡 ${activeConcept}</span>
        <span style="font-size:12px; color:#718096;">오늘 실시간 결과 분석</span>
      </div>
      <button class="util-btn ${isSaved ? 'saved' : ''}" onclick="toggleSaveQuiz('${todayDateStr}', ${lastIndex}, true)">
        ${isSaved ? '⭐ 보관됨' : '⭐ 문제 보관'}
      </button>
    </div>

    <div class="toggle-header" onclick="toggleSection(this, 'today-q-content')">
      <span>📝 출제된 코딩 테스트 문제</span>
      <span class="toggle-icon">▲ 접기</span>
    </div>
    <div id="today-q-content" class="toggle-content">
      <div class="quiz-question">${formatQuestionText(questionText)}</div>
    </div>

    <div style="text-align: center; font-size: 18px; font-weight: bold; color: ${isSuccess ? '#2f855a' : '#c53030'}; margin-top:15px; margin-bottom: 10px;">
      ${isSuccess ? "🟢 정답 처리되었습니다." : "🔴 오답 처리되었습니다."}
    </div>
    ${daySummaryHtml}

    <div class="toggle-header" onclick="toggleSection(this, 'today-exp-content')" style="background-color: #2b6cb0;">
      <span>💡 정밀 분석 해설 및 확정 정답</span>
      <span class="toggle-icon">▲ 접기</span>
    </div>
    <div id="today-exp-content" class="toggle-content">
      <div class="quiz-explanation">
        <div class="answer-highlight">📌 확정 정답: ${answerDisplayString}</div>
        <strong>상세 해설:</strong><br>${explanationText.replace(/</g, "&lt;").replace(/>/g, "&gt;")}
      </div>
    </div>

    <div style="margin-top: 15px;">
      <button onclick="startMoreQuiz()" style="width: 100%; background-color: #2b6cb0;">🚀 무작위 새 문제 하나 더 풀기</button>
    </div>
  `;
  
  safeHighlightAll();
}

function startMoreQuiz() {
  forceNewQuiz = true;
  fetchTodayQuiz();
}

// 캘린더 네비게이션
function moveMonth(direction) {
  if (direction === 0) currentCalendarDate = new Date();
  else currentCalendarDate.setMonth(currentCalendarDate.getMonth() + direction);
  initCalendar();
}

// 캘린더 생성 및 필터 동기화
function initCalendar() {
  const filterLangValue = document.getElementById("filterLang").value;
  const filterDiffValue = document.getElementById("filterDiff").value;
  
  if (filterLangValue !== "전체") {
    document.getElementById("langSelect").value = filterLangValue;
    selectedLang = filterLangValue;
    localStorage.setItem("selectedLang", selectedLang);
  }
  if (filterDiffValue !== "전체") {
    document.getElementById("difficultySelect").value = filterDiffValue;
    selectedDifficulty = filterDiffValue;
    localStorage.setItem("selectedDifficulty", selectedDifficulty);
  }

  const grid = document.getElementById("calendarGrid");
  const monthTitle = document.getElementById("calendarMonth");
  grid.innerHTML = "";

  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth(); 
  monthTitle.textContent = `${year}년 ${month + 1}월`;

  const weekDays = ["일", "월", "화", "수", "목", "금", "토"];
  weekDays.forEach(day => {
    const header = document.createElement("div");
    header.className = "calendar-header";
    header.textContent = day;
    grid.appendChild(header);
  });

  const firstDayIdx = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();

  for (let i = 0; i < firstDayIdx; i++) {
    grid.appendChild(document.createElement("div"));
  }

  for (let date = 1; date <= lastDate; date++) {
    const dayCell = document.createElement("div");
    dayCell.className = "calendar-day";

    const numDiv = document.createElement("div");
    numDiv.className = "day-num";
    numDiv.textContent = date;
    dayCell.appendChild(numDiv);

    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
    
    if (quizHistory[dateStr]) {
      const dayData = quizHistory[dateStr];
      
      let items = [];
      if (dayData.details && Array.isArray(dayData.details)) {
        items = dayData.details;
      } else {
        items = [{ 
          success: dayData.success, 
          language: dayData.language || "JavaScript",
          difficulty: dayData.difficulty || "보통",
          concept: dayData.concept || "기타",
          isReviewed: dayData.isReviewed || false
        }];
      }

      const filteredItems = items.filter(item => {
        const matchesLang = (filterLangValue === "전체" || (item.language || "JavaScript") === filterLangValue);
        const matchesDiff = (filterDiffValue === "전체" || (item.difficulty || "보통") === filterDiffValue);
        return matchesLang && matchesDiff;
      });

      if (filteredItems.length > 0) {
        dayCell.classList.add("has-data");
        dayCell.onclick = () => openNoteModal(dateStr); 

        const badgeContainer = document.createElement("div");
        badgeContainer.className = "badge-container";

        if (filteredItems.length === 1) {
          const singleBadge = document.createElement("div");
          const item = filteredItems[0];
          const isSuccess = item.success === true || item.success === "true";
          const isReviewed = item.isReviewed === true || item.isReviewed === "true";
          
          let themeClass = isSuccess ? 'rect-correct' : (isReviewed ? 'rect-reviewed' : 'rect-wrong');
          let labelText = isSuccess ? "정답" : (isReviewed ? "완료" : "오답");

          singleBadge.className = `quiz-rect-badge ${themeClass}`;
          singleBadge.textContent = labelText;
          badgeContainer.appendChild(singleBadge);
        } 
        else {
          const total = filteredItems.length;
          const DISPLAY_LIMIT = 6;
          
          for (let i = 0; i < total; i++) {
            if (i === (DISPLAY_LIMIT - 1) && total > DISPLAY_LIMIT) {
              const moreBadge = document.createElement("div");
              moreBadge.className = "quiz-mini-rect rect-more";
              moreBadge.textContent = "...";
              badgeContainer.appendChild(moreBadge);
              break;
            }
            
            const item = filteredItems[i];
            const miniRect = document.createElement("div");
            const isItemSuccess = item.success === true || item.success === "true";
            const isItemReviewed = item.isReviewed === true || item.isReviewed === "true";

            let miniTheme = isItemSuccess ? 'rect-correct' : (isItemReviewed ? 'rect-reviewed' : 'rect-wrong');
            miniRect.className = `quiz-mini-rect ${miniTheme}`;
            badgeContainer.appendChild(miniRect);
          }
        }
        dayCell.appendChild(badgeContainer);
      }
    }
    grid.appendChild(dayCell);
  }
}

// 상세 학습 복습 노트 모달 열기
function openNoteModal(dateStr) {
  activeModalDateStr = dateStr;
  const modal = document.getElementById("noteModal");
  const title = document.getElementById("modalTitle");
  const body = document.getElementById("modalBody");
  const notesTextArea = document.getElementById("modalCustomNotes");
  const notesWrapper = document.getElementById("modalNotesWrapper");
  
  const dayData = quizHistory[dateStr];
  if (!dayData) return;

  title.textContent = `📝 ${dateStr} 학습 복습 노트`;
  body.innerHTML = "";
  notesWrapper.style.display = "block"; 

  let items = [];
  if (dayData.details && Array.isArray(dayData.details)) {
    items = dayData.details;
  } else {
    items = [{ 
      success: dayData.success, 
      question: dayData.question, 
      explanation: dayData.explanation, 
      answer: dayData.answer, 
      options: dayData.options, 
      language: dayData.language || selectedLang,
      difficulty: dayData.difficulty || "보통",
      concept: dayData.concept || "기타",
      isReviewed: dayData.isReviewed, 
      isSaved: dayData.isSaved 
    }];
  }

  const filterLangValue = document.getElementById("filterLang").value;
  const filterDiffValue = document.getElementById("filterDiff").value;
  
  items = items.filter(item => {
    const matchesLang = (filterLangValue === "전체" || (item.language || "JavaScript") === filterLangValue);
    const matchesDiff = (filterDiffValue === "전체" || (item.difficulty || "보통") === filterDiffValue);
    return matchesLang && matchesDiff;
  });
  
  items.forEach((item, index) => {
    const itemDiv = document.createElement("div");
    itemDiv.className = "modal-item";
    
    let modalAnswerStr = "?";
    if (item.answer !== undefined && item.options && item.options[item.answer]) {
      modalAnswerStr = `${item.answer + 1}번 — "${item.options[item.answer].replace(/</g, "&lt;").replace(/>/g, "&gt;")}"`;
    } else if (item.answer !== undefined) {
      modalAnswerStr = `${item.answer + 1}번`;
    }

    const isItemSuccess = item.success === true || item.success === "true";
    const isItemReviewed = item.isReviewed === true || item.isReviewed === "true";
    const isItemSaved = item.isSaved === true || item.isSaved === "true";

    let statusText = isItemSuccess ? "🟢 정답 패스" : (isItemReviewed ? "🟡 숙지 완료 (복습 완료)" : "🔴 다시 보기 대상(오답)");
    let statusColor = isItemSuccess ? '#2f855a' : (isItemReviewed ? '#b45309' : '#c53030');

    const itemDiff = item.difficulty || "보통";
    const diffClass = getDifficultyClass(itemDiff);
    const itemLang = item.language || selectedLang;
    const itemConcept = item.concept || "일반 개념";

    const qId = `modal-q-${dateStr}-${index}`;
    const expId = `modal-exp-${dateStr}-${index}`;

    itemDiv.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; width:100%; gap:10px; margin-bottom: 10px;">
        <div style="display:flex; flex-direction:column; gap:4px; flex:1;">
          <div style="display:flex; gap:5px; align-items:center; flex-wrap:wrap;">
            <span class="difficulty-badge ${diffClass}">[${itemDiff}]</span>
            <span class="badge-lang">${itemLang}</span>
            <span class="badge-concept">💡 ${itemConcept}</span>
          </div>
          <h4 style="margin:4px 0 0 0; color:${statusColor};">
            ${index + 1}번 미션: ${statusText}
          </h4>
        </div>
        <div style="display:flex; gap:6px; align-items:center;">
          <button class="util-btn ${isItemSaved ? 'saved' : ''}" onclick="toggleSaveQuiz('${dateStr}', ${index}, false)">
            ${isItemSaved ? '⭐ 보관됨' : '⭐ 문제 보관'}
          </button>
          ${(!isItemSuccess && !isItemReviewed) ? `<button class="done-btn" onclick="markAsReviewed('${dateStr}', ${index})">✅ 숙지 완료</button>` : ''}
        </div>
      </div>

      <div class="toggle-header" onclick="toggleSection(this, '${qId}')" style="background-color: #718096;">
        <span>질문 문항 보기</span>
        <span class="toggle-icon">▲ 접기</span>
      </div>
      <div id="${qId}" class="toggle-content">
        <div class="quiz-question">${formatQuestionText(item.question)}</div>
      </div>

      <div class="toggle-header" onclick="toggleSection(this, '${expId}')" style="background-color: #4a5568;">
        <span>정답 및 정밀 해설 데이터</span>
        <span class="toggle-icon">▲ 접기</span>
      </div>
      <div id="${expId}" class="toggle-content">
        <div class="quiz-explanation" style="background-color:#f7fafc; font-size:13px;">
          <div class="answer-highlight">📌 확정 정답: ${modalAnswerStr}</div>
          <strong>해설:</strong><br>${(item.explanation || "해설 누락").replace(/</g, "&lt;").replace(/>/g, "&gt;")}
        </div>
      </div>
      
      <div style="margin-top: 10px; border-top: 1px dashed #cbd5e0; padding-top: 10px;">
        <textarea id="note-${dateStr}-${index}" style="width:100%; height:50px;" placeholder="이 문제의 메모를 입력하세요...">${item.customNotes || ""}</textarea>
        <button onclick="saveEachNote('${dateStr}', ${index})" style="width:100%; margin-top:5px; background:#6b7280; padding:5px; font-size:12px;">메모 저장</button>
      </div>
    `;

    body.appendChild(itemDiv);
  });

  notesTextArea.value = dayData.customNotes || "";

  modal.style.display = "flex";
  safeHighlightAll();
}

// 명품 문제 보관 기능 토글
function toggleSaveQuiz(dateStr, index, isMainView = false) {
  const dayData = quizHistory[dateStr];
  if (!dayData) return;

  if (dayData.details && Array.isArray(dayData.details)) {
    if (dayData.details[index]) {
      const currentStatus = dayData.details[index].isSaved || false;
      dayData.details[index].isSaved = !currentStatus;
    }
  } else {
    const currentStatus = dayData.isSaved || false;
    dayData.isSaved = !currentStatus;
  }

  localStorage.setItem("quizHistory", JSON.stringify(quizHistory));
  
  if (isMainView) {
    const targetItem = dayData.details ? dayData.details[index] : dayData;
    renderQuizResultView(targetItem.success, targetItem.question, targetItem.explanation, targetItem.answer, targetItem.options, targetItem.difficulty || "보통", targetItem.concept || "기타");
  } else {
    openNoteModal(dateStr);
  }
}

// 개별 숙지 완료 체크
function markAsReviewed(dateStr, index) {
  const dayData = quizHistory[dateStr];
  if (!dayData) return;

  if (dayData.details && Array.isArray(dayData.details)) {
    if (dayData.details[index]) {
      dayData.details[index].isReviewed = true;
    }
    const remainingWrong = dayData.details.filter(d => !d.success && !d.isReviewed);
    if (remainingWrong.length === 0) {
      dayData.isReviewed = true;
    }
  } else {
    dayData.isReviewed = true;
  }

  localStorage.setItem("quizHistory", JSON.stringify(quizHistory));
  alert("🎉 해당 문제를 오답노트에서 제외하고 완료(노란색) 상태로 변경했습니다.");
  
  openNoteModal(dateStr);
  initCalendar();
}

function markAsReviewedFromCollection(dateStr, index) {
  const dayData = quizHistory[dateStr];
  if (!dayData) return;

  if (dayData.details && Array.isArray(dayData.details)) {
    if (dayData.details[index]) dayData.details[index].isReviewed = true;
    const remainingWrong = dayData.details.filter(d => !d.success && !d.isReviewed);
    if (remainingWrong.length === 0) dayData.isReviewed = true;
  } else {
    dayData.isReviewed = true;
  }

  localStorage.setItem("quizHistory", JSON.stringify(quizHistory));
  
  openWrongAnswersOnlyModal();
  initCalendar();
}

// 오답 전용 모아보기 모달창 열기
function openWrongAnswersOnlyModal() {
  activeModalDateStr = null; 
  const modal = document.getElementById("noteModal");
  const title = document.getElementById("modalTitle");
  const body = document.getElementById("modalBody");
  const notesWrapper = document.getElementById("modalNotesWrapper");

  title.textContent = `🚨 전체 오답노트 정밀 복습 모음`;
  body.innerHTML = "";
  notesWrapper.style.display = "none"; 

  let wrongCount = 0;
  const dates = Object.keys(quizHistory).sort().reverse(); 
  
  dates.forEach(dateStr => {
    const dayData = quizHistory[dateStr];
    if (!dayData) return;

    let items = [];
    let isSingleMode = false;
    if (dayData.details && Array.isArray(dayData.details)) {
      items = dayData.details;
    } else {
      isSingleMode = true;
      items = [{ 
        success: dayData.success, 
        question: dayData.question, 
        explanation: dayData.explanation, 
        answer: dayData.answer, 
        options: dayData.options, 
        language: dayData.language || selectedLang,
        difficulty: dayData.difficulty || "보통",
        concept: dayData.concept || "기타",
        isReviewed: dayData.isReviewed 
      }];
    }
    
    items.forEach((item, index) => {
      const isWrong = (item.success === false || item.success === "false");
      const isAlreadyReviewed = (item.isReviewed === true || item.isReviewed === "true");

      if (isWrong && !isAlreadyReviewed) { 
        wrongCount++;
        const itemDiv = document.createElement("div");
        itemDiv.className = "modal-item";
        
        let modalAnswerStr = "?";
        if (item.answer !== undefined && item.options && item.options[item.answer]) {
          modalAnswerStr = `${item.answer + 1}번 — "${item.options[item.answer].replace(/</g, "&lt;").replace(/>/g, "&gt;")}"`;
        } else if (item.answer !== undefined) {
          modalAnswerStr = `${item.answer + 1}번`;
        }

        const targetIndex = isSingleMode ? 0 : index;
        
        const itemDiff = item.difficulty || "보통";
        const diffClass = getDifficultyClass(itemDiff);
        const itemLang = item.language || selectedLang;
        const itemConcept = item.concept || "지정 개념";

        const wrongQId = `wrong-q-${dateStr}-${index}`;
        const wrongExpId = `wrong-exp-${dateStr}-${index}`;

        itemDiv.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:10px;">
            <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
              <span style="font-weight:bold; color:#e53e3e; font-size:14px;">🔥 취약지점 #${wrongCount}</span>
              <span class="difficulty-badge ${diffClass}">[${itemDiff}]</span>
              <span class="badge-lang">${itemLang}</span>
              <span class="badge-concept">💡 ${itemConcept}</span>
            </div>
            <div style="display:flex; gap:8px; align-items:center;">
              <span style="font-size:12px; color:#718096; background:#edf2f7; padding:2px 8px; border-radius:12px;">풀이일: ${dateStr}</span>
              <button class="done-btn" onclick="markAsReviewedFromCollection('${dateStr}', ${targetIndex})">✅ 숙지 완료</button>
            </div>
          </div>

          <div class="toggle-header" onclick="toggleSection(this, '${wrongQId}')" style="background-color: #e53e3e;">
            <span>취약 문항 소스 코드 보기</span>
            <span class="toggle-icon">▲ 접기</span>
          </div>
          <div id="${wrongQId}" class="toggle-content">
            <div class="quiz-question">${formatQuestionText(item.question)}</div>
          </div>

          <div class="toggle-header" onclick="toggleSection(this, '${wrongExpId}')" style="background-color: #dd6b20;">
            <span>오답 원인 극복 해설</span>
            <span class="toggle-icon">▲ 접기</span>
          </div>
          <div id="${wrongExpId}" class="toggle-content">
            <div class="quiz-explanation" style="background-color:#fffaf0; border-left:4px solid #dd6b20; font-size:13px;">
              <div class="answer-highlight">📌 확정 정답: ${modalAnswerStr}</div>
              <strong>해설 데이터:</strong><br>${(item.explanation || "해설이 없습니다.").replace(/</g, "&lt;").replace(/>/g, "&gt;")}
            </div>
          </div>
        `;
        body.appendChild(itemDiv);
      }
    });
  });

  if (wrongCount === 0) {
    body.innerHTML = `<p style="text-align:center; padding:30px 0; color:#4a5568;">🎉 현재까지 밀린 오답이 전혀 없습니다! 모두 완벽하게 마스터하셨습니다.</p>`;
  }

  modal.style.display = "flex";
  safeHighlightAll();
}

// 보관함 모달창 열기
function openSavedQuizzesModal() {
  activeModalDateStr = null; 
  const modal = document.getElementById("noteModal");
  const title = document.getElementById("modalTitle");
  const body = document.getElementById("modalBody");
  const notesWrapper = document.getElementById("modalNotesWrapper");

  title.textContent = `📂 ⭐ 나만의 명품 문제 보관함`;
  body.innerHTML = "";
  notesWrapper.style.display = "none"; 

  let savedCount = 0;
  const dates = Object.keys(quizHistory).sort().reverse(); 
  
  dates.forEach(dateStr => {
    const dayData = quizHistory[dateStr];
    if (!dayData) return;

    let items = [];
    let isSingleMode = false;
    if (dayData.details && Array.isArray(dayData.details)) {
      items = dayData.details;
    } else {
      isSingleMode = true;
      items = [{ 
        success: dayData.success, 
        question: dayData.question, 
        explanation: dayData.explanation, 
        answer: dayData.answer, 
        options: dayData.options, 
        language: dayData.language || selectedLang,
        difficulty: dayData.difficulty || "보통",
        concept: dayData.concept || "기타",
        isSaved: dayData.isSaved 
      }];
    }
    
    items.forEach((item, index) => {
      const isItemSaved = (item.isSaved === true || item.isSaved === "true");

      if (isItemSaved) { 
        savedCount++;
        const itemDiv = document.createElement("div");
        itemDiv.className = "modal-item";
        
        let modalAnswerStr = "?";
        if (item.answer !== undefined && item.options && item.options[item.answer]) {
          modalAnswerStr = `${item.answer + 1}번 — "${item.options[item.answer].replace(/</g, "&lt;").replace(/>/g, "&gt;")}"`;
        } else if (item.answer !== undefined) {
          modalAnswerStr = `${item.answer + 1}번`;
        }

        const targetIndex = isSingleMode ? 0 : index;

        const itemDiff = item.difficulty || "보통";
        const diffClass = getDifficultyClass(itemDiff);
        const itemLang = item.language || selectedLang;
        const itemConcept = item.concept || "지정 개념";

        itemDiv.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:10px;">
            <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
              <span style="font-weight:bold; color:#319795; font-size:14px;">⭐ 보관 문항 #${savedCount}</span>
              <span class="difficulty-badge ${diffClass}">[${itemDiff}]</span>
              <span class="badge-lang">${itemLang}</span>
              <span class="badge-concept">💡 ${itemConcept}</span>
            </div>
            <div style="display:flex; gap:8px; align-items:center;">
              <span style="font-size:12px; color:#718096; background:#edf2f7; padding:2px 8px; border-radius:12px;">출처일: ${dateStr}</span>
              <button class="done-btn" style="background-color:#e53e3e;" onclick="removeFromSavedCollection('${dateStr}', ${targetIndex})">❌ 보관 해제</button>
            </div>
          </div>
          <div class="quiz-question">${formatQuestionText(item.question)}</div>
          <div class="quiz-explanation" style="background-color:#f7fafc; font-size:13px; margin-top:8px;">
            <div class="answer-highlight">📌 확정 정답: ${modalAnswerStr}</div>
            <strong>정밀 해설 데이터:</strong><br>${(item.explanation || "해설이 없습니다.").replace(/</g, "&lt;").replace(/>/g, "&gt;")}
          </div>
        `;
        body.appendChild(itemDiv);
      }
    });
  });

  if (savedCount === 0) {
    body.innerHTML = `<p style="text-align:center; padding:30px 0; color:#4a5568;">📂 아직 보관함에 저장된 특별한 문제가 없습니다.<br>좋은 문제를 만나면 [⭐ 문제 보관] 버튼을 눌러보세요!</p>`;
  }

  modal.style.display = "flex";
  safeHighlightAll();
}

function removeFromSavedCollection(dateStr, index) {
  const dayData = quizHistory[dateStr];
  if (!dayData) return;

  if (dayData.details && Array.isArray(dayData.details)) {
    if (dayData.details[index]) dayData.details[index].isSaved = false;
  } else {
    dayData.isSaved = false;
  }

  localStorage.setItem("quizHistory", JSON.stringify(quizHistory));
  openSavedQuizzesModal();
}

// 개별 메모 및 메인 메모 컴포넌트 저장 로직
function saveEachNote(dateStr, index) {
  const dayData = quizHistory[dateStr];
  const noteText = document.getElementById(`note-${dateStr}-${index}`).value;

  if (dayData.details && dayData.details[index]) {
    dayData.details[index].customNotes = noteText; 
  } else {
    dayData.customNotes = noteText; 
  }

  localStorage.setItem("quizHistory", JSON.stringify(quizHistory));
  alert("메모가 저장되었습니다!");
}

function saveMainModalNotes() {
  if (!activeModalDateStr || !quizHistory[activeModalDateStr]) return;
  const noteText = document.getElementById("modalCustomNotes").value;
  quizHistory[activeModalDateStr].customNotes = noteText;
  localStorage.setItem("quizHistory", JSON.stringify(quizHistory));
  alert("통합 복습 기록 메모가 매핑되어 저장되었습니다.");
}

// 모달 레이어 닫기
function closeModal(event) {
  // 인자 없이 트리거되거나 바깥 배경 클릭 시 모달 닫기
  if (!event || event.target === document.getElementById("noteModal") || event.target.className === "close-btn") {
    document.getElementById("noteModal").style.display = "none";
    activeModalDateStr = null;
  }
}

// 누적 성공률 통계 연산 구현
function calculateStats() {
  const statsResult = document.getElementById("statsResult");
  const historyArray = Object.values(quizHistory);

  if (historyArray.length === 0) {
    statsResult.innerHTML = "아직 도전한 코딩 테스트 기록이 없습니다. 문제를 가져와 시작해 보세요!";
    return;
  }

  let totalQuestions = 0;
  let totalCorrect = 0;

  historyArray.forEach(dayData => {
    if (dayData.totalCount !== undefined) {
      totalQuestions += dayData.totalCount;
      totalCorrect += dayData.correctCount;
    } else {
      totalQuestions += 1;
      if (dayData.success === true || dayData.success === "true") totalCorrect += 1;
    }
  });

  const accuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
  statsResult.innerHTML = `
    현재까지 총 <strong>${totalQuestions}문제</strong> 중 <strong>${totalCorrect}문제</strong> 클리어!<br>
    🎯 통합 코딩 테스트 성공률: <strong>${accuracy}%</strong>
  `;
}


// 브라우저가 서비스 워커를 지원하는지 체크 후 등록
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((registration) => {
        console.log('서비스 워커가 성공적으로 등록되었습니다. 범위:', registration.scope);
      })
      .catch((error) => {
        console.log('서비스 워커 등록 실패:', error);
      });
  });
}