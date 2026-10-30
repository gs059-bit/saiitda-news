/* 학생 가입 화면: 계정 생성은 반드시 서버 함수에서 검증합니다. */
function showStudentSignup(){
 const app=document.querySelector('#app');
 app.innerHTML=`<div class="panel" style="max-width:480px;margin:40px auto"><h2>사이잇다 학생 회원가입</h2><p class="muted">가입 신청 후 선생님의 승인을 기다려 주세요.</p><form id="studentSignupForm"><div class="field"><label for="studentUsername">아이디</label><input id="studentUsername" minlength="4" maxlength="20" pattern="[a-z0-9_]{4,20}" autocomplete="username" required placeholder="영어 소문자, 숫자, _"></div><div class="field"><label for="studentPassword">비밀번호 (8자 이상)</label><input id="studentPassword" type="password" minlength="8" autocomplete="new-password" required></div><div class="field"><label for="studentPenName">실제 이름</label><input id="studentPenName" maxlength="20" required></div><div class="field"><label for="studentRole">가입 유형</label><select id="studentRole"><option value="reader">일반 학생</option><option value="reporter">학생 기자</option></select></div><div class="field"><label for="studentInvite">선생님이 알려준 가입 코드</label><input id="studentInvite" required autocomplete="off"></div><button class="btn" type="submit">가입 신청하기</button></form><div id="signupMessage" role="status" aria-live="polite"></div></div>`;
 const form=document.querySelector('#studentSignupForm');
 form.addEventListener('submit',async e=>{
  e.preventDefault(); const button=form.querySelector('button'); button.disabled=true;
  const msg=document.querySelector('#signupMessage');msg.textContent='가입 신청 중입니다…';
  try{
   const cfg=window.SAIITDA_CONFIG;
   const resp=await fetch(cfg.supabaseUrl+'/functions/v1/student-register',{method:'POST',headers:{'Content-Type':'application/json','apikey':cfg.supabaseAnonKey},body:JSON.stringify({username:document.querySelector('#studentUsername').value.trim(),password:document.querySelector('#studentPassword').value,display_name:document.querySelector('#studentPenName').value.trim(),requested_role:document.querySelector('#studentRole').value,invite_code:document.querySelector('#studentInvite').value.trim()})});
   const data=await resp.json().catch(()=>({}));
   if(!resp.ok)throw Error(data.error||'가입 신청을 처리하지 못했습니다.');
   form.reset();msg.textContent='가입 신청 완료! 선생님의 승인을 기다려 주세요.';
  }catch(err){msg.textContent='가입 신청 실패: '+err.message;}
  finally{button.disabled=false;}
 });
}
