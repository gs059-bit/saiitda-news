// login.html: 로그인(#)과 회원가입(#signup)
import { ready, db } from './supabase.js';
import { $ } from './utils.js';
import { viewRole, requestRole, roleLabel } from './roles.js';

// "관리자를 선택한 뒤"처럼 역할 이름 뒤에 붙는 목적격 조사
const roleObj = { admin: '를', teacher: '을', reporter: '를', student: '을' };
const statusMsg = {
  pending: '가입 승인을 기다리는 중입니다. 관리자가 승인한 뒤 로그인할 수 있어요.',
  rejected: '가입이 승인되지 않았습니다. 관리자에게 문의해 주세요.'
};

function showMessage(target, msg, ok = false) {
  const d = document.createElement('div');
  d.className = 'notice' + (ok ? ' ok' : '');
  d.textContent = msg;
  $(target).replaceChildren(d);
}

// 아이디로 가입·로그인하는 계정은 내부 인증용 이메일(아이디@students.saiitda.invalid)로 바꿔 Supabase에 보낸다
const USERNAME_RE = /^[a-z0-9_]{4,20}$/;
const USERNAME_MSG = '아이디는 영문 소문자, 숫자, 밑줄(_)을 사용해 4~20자로 입력해 주세요.';
const usernameEmail = username => `${username}@students.saiitda.invalid`;

// 프로필이 없으면 승인 대기로, 승인 상태가 비어 있으면 승인된 것으로 본다
async function account(id) {
  const { data } = await db.from('profiles').select('role,approval_status').eq('id', id).maybeSingle();
  return { role: viewRole(data?.role), status: data ? data.approval_status || 'approved' : 'pending' };
}

function go(role) {
  location.href = ['admin', 'reporter'].includes(role) ? 'index.html#/dashboard' : 'index.html';
}

// 관리자가 임시 비밀번호를 발급한 계정이 로그인하면 켜져서, 새 비밀번호 정하기 화면을 보여 준다
let resetMode = false;

const views = { '': '#loginView', '#signup': '#signupView', '#forgot': '#forgotView', '#reset': '#resetView' };

function view() {
  const shown = views[resetMode ? '#reset' : location.hash] || views[''];
  for (const id of Object.values(views)) $(id).classList.toggle('hide', id !== shown);
  for (const m of ['#msg', '#smsg', '#fmsg', '#rmsg']) $(m).replaceChildren();
}

 // 선생님도 학생 기자, 일반 학생과 동일하게 가입 신청할 수 있다.
 // 실제 계정 권한은 최고 관리자가 승인한 뒤 부여된다.
function toggleTeacherNote() {
  $('#teacherNote').classList.add('hide');
  $('#signupFields').classList.remove('hide');
  $('#signupFields').disabled = false;
}

async function login(e) {
  e.preventDefault();
  $('#msg').replaceChildren();
  const btn = $('#loginform button');
  const fail = msg => {
    btn.disabled = false;
    showMessage('#msg', msg);
  };
  btn.disabled = true;
  const want = $('input[name=role]:checked').value;
  // 학생은 아이디, 기존 관리자 계정은 이메일을 그대로 입력한다
  const loginId = $('#email').value.trim();

  let loginEmail;

  if (loginId.includes('@')) {
    // 기존 관리자 계정(이메일)
    loginEmail = loginId;
  } else {
    // 학생 아이디를 내부 인증용 이메일로 변환
    const username = loginId.toLowerCase();

    if (!USERNAME_RE.test(username)) {
      fail(USERNAME_MSG);
      return;
    }

    loginEmail = usernameEmail(username);
  }

  const { data, error } = await db.auth.signInWithPassword({
    email: loginEmail,
    password: $('#password').value
  });
  if (error) {
    fail('로그인할 수 없습니다. 아이디와 비밀번호를 확인해 주세요.');
    return;
  }
  const { role, status } = await account(data.user.id);
  if (status !== 'approved') {
    await db.auth.signOut();
    fail(statusMsg[status] || statusMsg.pending);
    return;
  }
  if (role !== want) {
    await db.auth.signOut();
    fail(
      `이 계정은 ${roleLabel[role]} 계정입니다. 위에서 ${roleLabel[role]}${roleObj[role]} 선택한 뒤 다시 로그인해 주세요.`
    );
    return;
  }
  // 관리자가 임시 비밀번호를 발급한 계정은 새 비밀번호를 정해야 들어갈 수 있다
  if (data.user.user_metadata?.must_change_password) {
    resetMode = true;
    view();
    showMessage('#rmsg', '임시 비밀번호로 로그인했습니다. 사용할 새 비밀번호를 정해 주세요.', true);
    return;
  }
  go(role);
}

async function signup(e) {
  e.preventDefault();
  $('#smsg').replaceChildren();
  const name = $('#sname').value.trim();
  const username = $('#semail').value.trim().toLowerCase();
  if (!USERNAME_RE.test(username)) {
    showMessage('#smsg', USERNAME_MSG);
    return;
  }
  const password = $('#spass').value;
  if (password !== $('#spass2').value) {
    showMessage('#smsg', '비밀번호와 비밀번호 확인이 서로 다릅니다.');
    return;
  }
  const btn = $('#signupform button');
  btn.disabled = true;
  // requested_role은 관리자가 참고할 신청 정보일 뿐, 실제 권한은 profiles.role로만 정해진다
  const { data, error } = await db.auth.signUp({
    email: usernameEmail(username),
    password,
    options: { data: { display_name: name, username, requested_role: requestRole[$('input[name=srole]:checked').value] } }
  });
  btn.disabled = false;
  if (error) {
    showMessage(
      '#smsg',
      /already|registered/i.test(error.message)
        ? '이미 사용 중인 아이디입니다. 다른 아이디를 입력해 주세요.'
        : `가입할 수 없습니다. (${error.message})`
    );
    return;
  }
  if (data.session) await db.auth.signOut();
  $('#signupform').reset();
  toggleTeacherNote();
  showMessage(
    '#smsg',
    '가입 신청이 완료되었습니다. 관리자가 승인하면 아이디와 비밀번호로 로그인할 수 있어요.',
    true
  );
}

// 비밀번호 찾기: 아이디로 관리자에게 재설정을 요청한다(없는 아이디여도 같은 안내를 보여 준다)
async function forgot(e) {
  e.preventDefault();
  const btn = $('#forgotform button');
  const username = $('#femail').value.trim().toLowerCase();
  if (!USERNAME_RE.test(username)) {
    showMessage('#fmsg', USERNAME_MSG);
    return;
  }
  btn.disabled = true;
  const { error } = await db.rpc('request_password_reset', { p_username: username });
  btn.disabled = false;
  if (error) {
    showMessage('#fmsg', `요청할 수 없습니다. 잠시 뒤 다시 시도해 주세요. (${error.message})`);
    return;
  }
  $('#forgotform').reset();
  showMessage(
    '#fmsg',
    '재설정을 요청했어요. 관리자가 확인하면 임시 비밀번호를 알려 줄 거예요. 임시 비밀번호로 로그인하면 새 비밀번호를 정할 수 있어요.',
    true
  );
}

async function resetPassword(e) {
  e.preventDefault();
  const password = $('#rpass').value;
  if (password !== $('#rpass2').value) {
    showMessage('#rmsg', '비밀번호와 비밀번호 확인이 서로 다릅니다.');
    return;
  }
  const btn = $('#resetform button');
  btn.disabled = true;
  const { error } = await db.auth.updateUser({ password, data: { must_change_password: false } });
  btn.disabled = false;
  if (error) {
    showMessage('#rmsg', `비밀번호를 바꿀 수 없습니다. (${error.message})`);
    return;
  }
  // 임시 비밀번호로 만들어진 로그인은 끊고, 새 비밀번호로 직접 로그인하게 한다
  await db.auth.signOut();
  resetMode = false;
  view();
  showMessage('#msg', '비밀번호를 바꿨습니다. 새 비밀번호로 로그인해 주세요.', true);
}

async function init() {
  view();
  toggleTeacherNote();
  window.addEventListener('hashchange', view);
  document.querySelectorAll('input[name=srole]').forEach(r => {
    r.onchange = toggleTeacherNote;
  });
  $('#loginform').onsubmit = login;
  $('#signupform').onsubmit = signup;
  $('#forgotform').onsubmit = forgot;
  $('#resetform').onsubmit = resetPassword;
  if (!ready) {
    showMessage('#msg', '먼저 Supabase 연결 설정을 완료해 주세요.');
    document.querySelectorAll('.btn').forEach(b => {
      b.disabled = true;
    });
    return;
  }
  // 이미 로그인되어 있으면 바로 이동, 승인 전 계정이면 로그아웃
  const { data } = await db.auth.getSession();
  if (!data.session) return;
  const acc = await account(data.session.user.id);
  if (acc.status === 'approved') go(acc.role);
  else await db.auth.signOut();
}

init();
