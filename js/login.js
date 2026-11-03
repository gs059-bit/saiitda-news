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

 // 선생님도 학생 기자, 일반 학생과 동일하게 가입 신청할 수 있다.
 // 실제 계정 권한은 최고 관리자가 승인한 뒤 부여된다.
  const teacher = document.querySelector(
    'input[name=srole]:checked'
  )?.value === 'teacher';

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
   // 아이디 또는 이메일 입력값
  const loginId = $('#email').value.trim();

  let loginEmail;

  if (loginId.includes('@')) {
    // 기존 관리자 및 이메일 계정
    loginEmail = loginId;
  } else {
    // 학생 아이디를 내부 인증용 이메일로 변환
    const username = loginId.toLowerCase();

    if (!/^[a-z0-9_]{4,20}$/.test(username)) {
      fail('아이디는 영문 소문자, 숫자, 밑줄(_)을 사용해 4~20자로 입력해 주세요.');
      return;
    }

    loginEmail = `${username}@students.saiitda.invalid`;
  }

  const { data, error } = await db.auth.signInWithPassword({
    email: loginEmail,
    password: $('#password').value
  });
  if (error) {
    fail('로그인할 수 없습니다. 아이디와 비밀번호를 확인해 주세요. 가입 승인 상태도 확인해 주세요.');
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
  const username = $('#susername').value.trim().toLowerCase();
  const password = $('#spass').value;
  const inviteCode = $('#scode').value.trim();
  const selectedRole =
    document.querySelector('input[name=srole]:checked')?.value;

  if (!['student', 'reporter'].includes(selectedRole)) {
    showMessage('#smsg', '학생 가입 유형을 선택해 주세요.');
    return;
  }

  if (!/^[a-z0-9_]{4,20}$/.test(username)) {
    showMessage('#smsg', '아이디는 영문 소문자, 숫자, 밑줄(_)로 4~20자여야 합니다.');
    return;
  }

  if (name.length < 2 || name.length > 20) {
    showMessage('#smsg', '이름은 2~20자로 입력해 주세요.');
    return;
  }

  if (password.length < 8 || password.length > 128) {
    showMessage('#smsg', '비밀번호는 8~128자로 입력해 주세요.');
    return;
  }

  if (password !== $('#spass2').value) {
    showMessage('#smsg', '비밀번호 확인이 일치하지 않습니다.');
    return;
  }

  if (!inviteCode) {
    showMessage('#smsg', '가입 초대 코드를 입력해 주세요.');
    return;
  }

  const btn = $('#signupform button[type=submit]');
  btn.disabled = true;

  try {
    const { data, error } = await db.functions.invoke(
      'student-register',
      {
        body: {
          username,
          password,
          display_name: name,
          requested_role: requestRole[selectedRole],
          invite_code: inviteCode
        }
      }
    );

    if (error) {
      let message = '가입 요청을 처리하지 못했습니다.';

      try {
        const details = await error.context?.json();
        if (details?.error) message = details.error;
      } catch (_) {}

      showMessage('#smsg', message);
      return;
    }

    if (!data?.ok) {
      showMessage('#smsg', data?.error || '가입 처리 결과를 확인할 수 없습니다.');
      return;
    }

    $('#signupform').reset();
    toggleTeacherNote();

    showMessage(
      '#smsg',
      '가입 신청이 접수되었습니다. 관리자 승인 후 로그인할 수 있습니다.',
      true
    );
  } catch (error) {
    console.error('가입 요청 오류:', error);
    showMessage('#smsg', '서버 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.');
  } finally {
    btn.disabled = false;
  }
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
