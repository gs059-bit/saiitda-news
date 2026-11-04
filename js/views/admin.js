// 최고 관리자 전용 기자실 메뉴: 카테고리, 사이트 디자인, 가입 승인, 회원 관리
import { ready, db } from '../supabase.js';
import { $, esc, date, errorText, onClick } from '../utils.js';
import { viewRole, roleLabel } from '../roles.js';
import { state, isAdmin, published, loadSettings, applySettings } from '../state.js';
import { notice } from '../ui.js';
import { nav } from '../app.js';

const options = (list, current) =>
  list
    .map(
      ([value, label]) => `<option value="${esc(value)}" ${current === value ? 'selected' : ''}>${esc(label)}</option>`
    )
    .join('');

export function categoryEditor() {
  if (!isAdmin()) return;
  $('#workspace').innerHTML = `<h2>카테고리 관리</h2>
    <p class="muted">한 줄에 하나씩 카테고리를 입력하세요. 기존 기사에서 사용 중인 카테고리를 삭제하면 해당 기사는 예전 분류로 남을 수 있습니다.</p>
    <div class="field"><label for="cats">카테고리 목록</label><textarea id="cats">${esc(state.categories.join('\n'))}</textarea></div>
    <button class="btn" id="saveCats">저장</button>
    <div id="catmsg"></div>`;
  $('#saveCats').onclick = async () => {
    const names = [
      ...new Set(
        $('#cats')
          .value.split('\n')
          .map(x => x.trim())
          .filter(Boolean)
      )
    ];
    if (!names.length || names.some(x => x.length > 40)) {
      $('#catmsg').innerHTML = notice('카테고리를 1~40자로 입력해 주세요.', true);
      return;
    }
    // 지우고 다시 넣기를 DB 함수(database/admin-tools.sql) 하나로 해서, 실패하면 기존 목록이 그대로 남는다
    const { error } = await db.rpc('save_categories', { names });
    if (error) {
      $('#catmsg').innerHTML = notice(errorText(error), true);
      return;
    }
    state.categories = names;
    nav();
    $('#catmsg').innerHTML = notice('카테고리를 저장했습니다.');
  };
}

export function designEditor() {
  if (!isAdmin()) return;
  const x = state.siteSettings;
  $('#workspace').innerHTML = `<h2>사이트 디자인 설정</h2>
    <p class="muted">최고 관리자만 수정할 수 있어요. 미리보기 후 저장하면 모든 방문자에게 적용됩니다.</p>
    <form id="designForm">
      <div class="field">
        <label for="siteTitle">신문 이름 (브라우저 제목)</label>
        <input id="siteTitle" maxlength="50" value="${esc(x.site_title)}">
      </div>
      <div class="field">
        <label for="siteTagline">로고 아래 소개 문구</label>
        <input id="siteTagline" maxlength="120" value="${esc(x.tagline)}">
      </div>
      <div class="field">
        <label for="issue">이번 호 표시 (메인 대표 기사 위, 예: 제3호 · 2026년 11월)</label>
        <input id="issue" maxlength="40" value="${esc(x.issue || '')}">
      </div>
      <div class="field">
        <label for="accent">강조 색상</label>
        <input id="accent" type="color" value="${esc(x.accent)}" style="height:48px;width:110px">
      </div>
      <div class="field">
        <label for="logoWidth">로고 크기: <output id="logoSize">${Number(x.logo_width)}</output>px</label>
        <input id="logoWidth" type="range" min="220" max="700" step="10" value="${Number(x.logo_width)}">
      </div>
      <div class="field">
        <label for="fontChoice">기사 제목 글꼴</label>
        <select id="fontChoice">${options(
          [
            ['classic', '정통 신문 스타일'],
            ['modern', '현대적 뉴스 스타일']
          ],
          x.font
        )}</select>
      </div>
      <div class="field">
        <label for="layoutChoice">기사 목록 배치</label>
        <select id="layoutChoice">${options(
          [
            ['grid', '사진 카드형 (3열)'],
            ['list', '기사 목록형 (1열)']
          ],
          x.layout
        )}</select>
      </div>
      <div class="field">
        <label for="featured">메인 대표 기사 (전체기사에서는 최신 발행 기사 자동 표시)</label>
        <select id="featured">${options([['', '최신 발행 기사 자동 선택'], ...published().map(a => [a.id, a.title])], x.featured_id ?? '')}</select>
      </div>
      <div class="actions">
        <button type="button" class="btn secondary" id="previewDesign">미리보기</button>
        <button type="submit" class="btn">디자인 저장</button>
        <button type="button" class="btn secondary" id="resetDesign">변경 취소</button>
      </div>
      <div id="designMsg"></div>
    </form>`;

  const read = () => ({
    site_title: $('#siteTitle').value.trim().slice(0, 50) || '사이잇다',
    tagline: $('#siteTagline').value.trim().slice(0, 120),
    issue: $('#issue').value.trim().slice(0, 40),
    accent: $('#accent').value,
    logo_width: Number($('#logoWidth').value),
    font: $('#fontChoice').value,
    layout: $('#layoutChoice').value,
    featured_id: $('#featured').value || null
  });
  const message = (msg, bad) => {
    $('#designMsg').innerHTML = notice(msg, bad);
  };

  $('#logoWidth').oninput = () => {
    $('#logoSize').textContent = $('#logoWidth').value;
  };
  $('#previewDesign').onclick = () => {
    state.siteSettings = { ...state.siteSettings, ...read() };
    applySettings();
    message('현재 화면에 미리 적용했습니다. 방문자에게 반영하려면 저장하세요.');
  };
  $('#resetDesign').onclick = async () => {
    await loadSettings();
    designEditor();
  };
  $('#designForm').onsubmit = async e => {
    e.preventDefault();
    if (!ready) {
      message('Supabase 연결 후 저장할 수 있습니다.', true);
      return;
    }
    const value = read();
    const { error } = await db.from('site_settings').upsert({ key: 'main', value });
    if (error) {
      message(errorText(error), true);
      return;
    }
    state.siteSettings = { ...state.siteSettings, ...value };
    applySettings();
    message('디자인을 저장했습니다. 모든 방문자에게 적용됩니다.');
  };
}

export async function signupRequests() {
  if (!isAdmin()) return;
  const ws = $('#workspace');
  ws.innerHTML = '<h2>가입 승인</h2><p class="muted">불러오는 중…</p>';
  const { data, error } = await db
    .from('profiles')
    .select('id,display_name,username,requested_role,created_at')
    .eq('approval_status', 'pending')
    .order('created_at');
  if (error) {
    ws.innerHTML = `<h2>가입 승인</h2>${notice(errorText(error), true)}`;
    return;
  }
  const want = {
  teacher_admin: '선생님',
  reporter: '학생 기자',
  reader: '일반 학생'
};
  ws.innerHTML = `<h2>가입 승인 (${data.length})</h2>
   
<p class="muted">선생님, 학생 기자, 일반 학생의 가입 신청을 확인하고 승인할 수 있습니다. 가입 승인은 최고 관리자만 가능합니다.</p>

    ${
      data.length
        ? data
            .map(
              p => `<div class="entry">
      <div>
        <span class="status">${want[p.requested_role] || '일반 학생'} 신청</span>
        <h3>${esc(p.display_name)}</h3>
        <div class="meta">${p.username ? esc(p.username) + ' · ' : ''}${date(p.created_at)}</div>
      </div>
      <div class="actions">
        <button class="btn" data-approve-user="${p.id}">승인</button>
        <button class="btn secondary" data-reject-user="${p.id}">거절</button>
      </div>
    </div>`
            )
            .join('')
        : '<p class="muted">기다리는 가입 신청이 없습니다.</p>'
    }`;

  onClick(
    '[data-approve-user]',
    async b => {
      if (!confirm('이 가입 신청을 승인할까요?')) return;
      const { error } = await db.rpc('approve_student_signup', { target_student_id: b.dataset.approveUser });
      if (error) alert(errorText(error));
      else signupRequests();
    },
    ws
  );
  onClick(
    '[data-reject-user]',
    async b => {
      if (!confirm('이 가입 신청을 거절할까요?')) return;
      const { error } = await db
        .from('profiles')
        .update({ approval_status: 'rejected' })
        .eq('id', b.dataset.rejectUser);
      if (error) alert(errorText(error));
      else signupRequests();
    },
    ws
  );
}

// 아이디 가입 회원의 비밀번호 재설정 요청. 임시 비밀번호는 Edge Function(supabase/functions/reset-student-password)이 만든다
export async function passwordRequests(issued) {
  if (!isAdmin()) return;
  const ws = $('#workspace');
  ws.innerHTML = '<h2>비밀번호 재설정</h2><p class="muted">불러오는 중…</p>';
  const { data, error } = await db
    .from('password_reset_requests')
    .select('id,username,display_name,created_at')
    .eq('status', 'pending')
    .order('created_at');
  if (error) {
    ws.innerHTML = `<h2>비밀번호 재설정</h2>${notice(errorText(error), true)}`;
    return;
  }
  // 방금 발급한 임시 비밀번호는 이 화면에서만 보인다. 학생에게 직접 알려 주면 된다
  const result = issued
    ? `<div class="notice ok"><strong>${esc(issued.username)}</strong> 학생의 임시 비밀번호: <strong style="font-size:1.2em;letter-spacing:.05em">${esc(issued.password)}</strong><br>이 화면을 닫으면 다시 볼 수 없어요. 학생에게 알려 주세요. 학생은 이 비밀번호로 로그인한 뒤 새 비밀번호를 정하게 됩니다.</div>`
    : '';
  ws.innerHTML = `<h2>비밀번호 재설정 (${data.length})</h2>
    <p class="muted">아이디로 가입한 학생이 로그인 화면에서 요청하면 여기에 나타납니다. 임시 비밀번호를 만들어 학생에게 알려 주세요.</p>
    ${result}
    ${
      data.length
        ? data
            .map(
              p => `<div class="entry">
      <div>
        <h3>${esc(p.display_name || '이름 없음')}</h3>
        <div class="meta">${esc(p.username)} · 요청 ${date(p.created_at)}</div>
      </div>
      <div class="actions">
        <button class="btn" data-issue="${p.id}">임시 비밀번호 만들기</button>
        <button class="btn secondary" data-dismiss="${p.id}">무시</button>
      </div>
    </div>`
            )
            .join('')
        : '<p class="muted">기다리는 요청이 없습니다.</p>'
    }`;

  onClick(
    '[data-issue]',
    async b => {
      if (!confirm('이 학생의 비밀번호를 임시 비밀번호로 바꿀까요? 지금 쓰던 비밀번호로는 로그인할 수 없게 됩니다.')) return;
      b.disabled = true;
      const { data: res, error: err } = await db.functions.invoke('reset-student-password', {
        body: { request_id: b.dataset.issue }
      });
      if (err || res?.error) {
        b.disabled = false;
        alert(res?.error || '임시 비밀번호를 만들지 못했습니다. Edge Function이 배포되어 있는지 확인해 주세요.');
        return;
      }
      passwordRequests(res);
    },
    ws
  );
  onClick(
    '[data-dismiss]',
    async b => {
      if (!confirm('이 요청을 무시할까요? 비밀번호는 바뀌지 않습니다.')) return;
      const { error: err } = await db
        .from('password_reset_requests')
        .update({ status: 'rejected', handled_at: new Date().toISOString() })
        .eq('id', b.dataset.dismiss);
      if (err) alert(errorText(err));
      else passwordRequests();
    },
    ws
  );
}

// 승인된(또는 막힌) 회원 목록. 학생 기자 ↔ 일반 학생, 로그인 막기·다시 허용은 DB 함수 set_member()로 한다

export async function members() {
  if (!isAdmin()) return;

  const ws = $('#workspace');
  ws.innerHTML = '<h2>회원 관리</h2><p class="muted">불러오는 중…</p>';

  const { data, error } = await db
    .from('profiles')
    .select('id,display_name,username,role,is_super_admin,approval_status,created_at')
    .is('deleted_at', null)
    .or('approval_status.is.null,approval_status.neq.pending')
    .order('display_name');

  if (error) {
    ws.innerHTML = `<h2>회원 관리</h2>${notice(errorText(error), true)}`;
    return;
  }

  ws.innerHTML = `<h2>회원 관리 (${data.length})</h2>
    <p class="muted">
      학생 기자와 일반 학생의 권한을 변경하거나,
      로그인을 막고 학생 계정을 삭제할 수 있습니다.
      계정을 삭제해도 작성한 기사와 댓글은 남습니다.
      관리자·선생님 계정은 보호됩니다.
    </p>
    ${
      data.length
        ? data.map(memberItem).join('')
        : '<p class="muted">회원이 없습니다.</p>'
    }`;

  // 기존 회원 권한 변경 기능
  onClick(
    '[data-member]',
    async b => {
      if (!confirm(b.dataset.ask)) return;

      const { error } = await db.rpc('set_member', {
        target: b.dataset.member,
        new_role: b.dataset.role,
        new_status: b.dataset.status
      });

      if (error) alert(errorText(error));
      else members();
    },
    ws
  );

  // 학생 계정 삭제 기능
  onClick(
    '[data-delete-student]',
    async b => {
      const name = b.dataset.name || '이 학생';

      if (!confirm(
        `${name} 학생의 계정을 삭제할까요?\n\n` +
        '기존 아이디로 로그인할 수 없게 됩니다.\n' +
        '작성한 기사와 댓글은 남습니다.'
      )) return;

      const answer = prompt(
        '실수로 삭제하지 않도록 "삭제"라고 입력해 주세요.'
      );

      if (answer !== '삭제') return;

      b.disabled = true;

      const { data, error } = await db.functions.invoke(
        'delete-student-account',
        {
          body: {
            target_id: b.dataset.deleteStudent
          }
        }
      );

      if (error || !data?.success) {
        alert(
          data?.error ||
          '계정 삭제에 실패했습니다. 관리자에게 확인해 주세요.'
        );
        b.disabled = false;
        return;
      }

      alert(`${name} 학생의 로그인 계정이 삭제 처리되었습니다.`);
      members();
    },
    ws
  );
}

function memberItem(p) {
  const blocked = p.approval_status === 'rejected';

  const fixed =
    ['admin', 'teacher_admin', 'super_admin'].includes(p.role) ||
    p.is_super_admin === true;

  const role = p.role === 'reporter' ? 'reporter' : 'reader';
  const status = blocked ? 'rejected' : 'approved';

  const button = (
    label,
    newRole,
    newStatus,
    ask,
    kind = 'secondary'
  ) =>
    `<button class="btn ${kind}"
      data-member="${p.id}"
      data-role="${newRole}"
      data-status="${newStatus}"
      data-ask="${esc(ask)}">${label}</button>`;

  let actions;

  if (fixed) {
    actions = '<span class="small muted">Supabase에서 지정</span>';
  } else {
    actions =
      (role === 'reporter'
        ? button(
            '일반 학생으로',
            'reader',
            status,
            '이 회원을 일반 학생으로 바꿀까요?'
          )
        : button(
            '학생 기자로',
            'reporter',
            status,
            '이 회원을 학생 기자로 바꿀까요?'
          )
      ) +
      (blocked
        ? button(
            '다시 허용',
            role,
            'approved',
            '이 회원이 다시 로그인할 수 있게 할까요?'
          )
        : button(
            '로그인 막기',
            role,
            'rejected',
            '이 회원의 로그인을 막을까요?',
            'danger'
          )
      ) +
      `<button
        class="btn secondary"
        style="border-color:#b42318;color:#b42318"
        data-delete-student="${p.id}"
        data-name="${esc(p.display_name || '이름 없음')}">
        계정 삭제
      </button>`;
  }

  return `<div class="entry">
    <div>
      <span class="status">
        ${blocked ? '로그인 막힘' : roleLabel[viewRole(p.role)]}
      </span>
      <h3>${esc(p.display_name || '이름 없음')}</h3>
      <div class="meta">
        ${p.username ? esc(p.username) + ' · ' : ''}
        가입 ${date(p.created_at)}
      </div>
    </div>
    <div class="actions">${actions}</div>
  </div>`;
}
