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

// 프로필이 없으면 승인 대기로, 승인 상태가 비어 있으면 승인된 것으로 본다
async function account(id) {
  const { data } = await db.from('profiles').select('role,approval_status').eq('id', id).maybeSingle();
  return { role: viewRole(data?.role), status: data ? data.approval_status || 'approved' : 'pending' };
}

function go(role) {
  location.href = ['admin', 'reporter'].includes(role) ? 'index.html#/dashboard' : 'index.html';
}

// 비밀번호 재설정 메일의 링크는 login.html?reset=1#access_token=... 으로 들어온다
let resetMode = new URLSearchParams(location.search).has('reset');

const views = { '': '#loginView', '#signup': '#signupView', '#forgot': '#forgotView', '#reset': '#resetView' };

function view() {
  const shown = views[resetMode ? '#reset' : location.hash] || views[''];
  for (const id of Object.values(views)) $(id).classList.toggle('hide', id !== shown);
  for (const m of ['#msg', '#smsg', '#fmsg', '#rmsg']) $(m).replaceChildren();
}

// 선생님 계정은 DB 규칙상 스스로 가입할 수 없고 최고 관리자가 지정한다
function toggleTeacherNote() {
  const teacher = $('input[name=srole]:checked').value === 'teacher';
  $('#teacherNote').classList.toggle('hide', !teacher);
  $('#signupFields').classList.toggle('hide', teacher);
  $('#signupFields').disabled = teacher;
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
  const { data, error } = await db.auth.signInWithPassword({
    email: $('#email').value.trim(),
    password: $('#password').value
  });
  if (error) {
    fail('로그인할 수 없습니다. 이메일과 비밀번호를 확인해 주세요. 가입 직후라면 이메일 인증을 먼저 완료해 주세요.');
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
  go(role);
}

async function signup(e) {
  e.preventDefault();
  $('#smsg').replaceChildren();
  const name = $('#sname').value.trim();
  const email = $('#semail').value.trim();
  const password = $('#spass').value;
  if (password !== $('#spass2').value) {
    showMessage('#smsg', '비밀번호와 비밀번호 확인이 서로 다릅니다.');
    return;
  }
  const btn = $('#signupform button');
  btn.disabled = true;
  // requested_role은 관리자가 참고할 신청 정보일 뿐, 실제 권한은 profiles.role로만 정해진다
  const { data, error } = await db.auth.signUp({
    email,
    password,
    options: { data: { display_name: name, requested_role: requestRole[$('input[name=srole]:checked').value] } }
  });
  btn.disabled = false;
  if (error) {
    showMessage('#smsg', `가입할 수 없습니다. (${error.message})`);
    return;
  }
  if (data.session) await db.auth.signOut();
  $('#signupform').reset();
  toggleTeacherNote();
  showMessage(
    '#smsg',
    data.session
      ? '가입 신청이 완료되었습니다. 관리자가 승인하면 로그인할 수 있어요.'
      : '가입 신청이 완료되었습니다. 이메일로 보낸 인증 링크를 누르고, 관리자가 승인하면 로그인할 수 있어요.',
    true
  );
}

// Supabase 대시보드의 Authentication → URL Configuration → Redirect URLs에 이 주소가 등록되어 있어야 한다
async function forgot(e) {
  e.preventDefault();
  const btn = $('#forgotform button');
  btn.disabled = true;
  const { error } = await db.auth.resetPasswordForEmail($('#femail').value.trim(), {
    redirectTo: new URL('login.html?reset=1', location.href).href
  });
  btn.disabled = false;
  if (error) {
    showMessage('#fmsg', `메일을 보낼 수 없습니다. 잠시 뒤 다시 시도해 주세요. (${error.message})`);
    return;
  }
  $('#forgotform').reset();
  showMessage(
    '#fmsg',
    '가입된 이메일이라면 비밀번호 재설정 링크가 도착합니다. 메일이 보이지 않으면 스팸함도 확인해 주세요.',
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
  const { error } = await db.auth.updateUser({ password });
  btn.disabled = false;
  if (error) {
    showMessage('#rmsg', `비밀번호를 바꿀 수 없습니다. (${error.message})`);
    return;
  }
  // 재설정 링크로 만들어진 로그인은 끊고, 새 비밀번호로 직접 로그인하게 한다
  await db.auth.signOut();
  resetMode = false;
  history.replaceState(null, '', location.pathname);
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
  // 재설정 링크로 들어오면 그 로그인으로 기자실에 넘어가지 않고 새 비밀번호부터 받는다
  if (resetMode) {
    if (!data.session) {
      $('#resetFields').disabled = true;
      showMessage('#rmsg', '링크가 만료되었거나 이미 사용되었습니다. 아래에서 링크를 다시 받아 주세요.');
    }
    return;
  }
  if (!data.session) return;
  const acc = await account(data.session.user.id);
  if (acc.status === 'approved') go(acc.role);
  else await db.auth.signOut();
}

init();
