
/*
 * 사이잇다 - 학생 회원가입 화면
 * 개발용 student-signup 브랜치
 */

function showStudentSignup() {
  const app = document.querySelector('#app');

  app.innerHTML = `
    <div class="panel" style="max-width:480px;margin:40px auto">
      <h2>사이잇다 학생 회원가입</h2>
      <p class="muted">
        회원가입 후 선생님의 승인을 받아야 활동할 수 있어요.
      </p>

      <form id="studentSignupForm">
        <div class="field">
          <label for="studentUsername">아이디</label>
          <input
            id="studentUsername"
            type="text"
            minlength="4"
            maxlength="20"
            pattern="[a-z0-9_]{4,20}"
            placeholder="영어 소문자, 숫자, 밑줄 사용"
            autocomplete="username"
            required
          >
        </div>

        <div class="field">
          <label for="studentPassword">비밀번호</label>
          <input
            id="studentPassword"
            type="password"
            minlength="8"
            autocomplete="new-password"
            required
          >
        </div>

        <div class="field">
          <label for="studentPenName">이</label>
          <input
            id="studentPenName"
            type="text"
            maxlength="20"
            placeholder="이름을 입력하세요"
            required
          >
        </div>

        <div class="field">
          <label for="studentRole">가입 유형</label>
          <select id="studentRole" required>
            <option value="reader">일반 학생</option>
            <option value="reporter">학생 기자</option>
          </select>
        </div>

        <button class="btn" type="submit">
          가입 신청하기
        </button>
      </form>

      <div id="signupMessage"></div>
    </div>
  `;

  document.querySelector('#studentSignupForm')
    .addEventListener('submit', (event) => {
      event.preventDefault();

      document.querySelector('#signupMessage').textContent =
        '회원가입 서버 연결 준비 중입니다.';
    });
}
