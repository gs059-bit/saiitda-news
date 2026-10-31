// 기자실: 기사 목록과 승인·발행. 관리자에게는 관리 메뉴(views/admin.js)도 보인다
import { db } from '../supabase.js';
import { $, esc, date, errorText, onClick } from '../utils.js';
import { state, isAdmin, canWrite, isMine, loadArticles } from '../state.js';
import { notice } from '../ui.js';
import { categoryEditor, designEditor, signupRequests, members } from './admin.js';
import { removePhoto } from './editor.js';
import { articleStats } from '../stats.js';

const statusName = { draft: '임시 저장', pending: '승인 대기', published: '발행됨', rejected: '수정 요청' };

// 관리자 기사 상태 바꾸기: 확인 문구(또는 입력받을 질문)와 바꿀 값
const ARTICLE_ACTIONS = {
  publish: {
    confirm: '이 기사를 전체 방문자에게 공개할까요?',
    fields: () => ({ status: 'published', published_at: new Date().toISOString() })
  },
  unpublish: { confirm: '이 기사를 비공개 처리할까요?', fields: () => ({ status: 'draft', published_at: null }) },
  reject: {
    ask: '학생 기자에게 보여 줄 수정 요청 내용을 적어 주세요.',
    fields: note => ({ status: 'rejected', review_note: note })
  },
  delete: { confirm: '기사를 영구 삭제할까요?' }
};

export function dashboard() {
  if (!state.session) {
    location.href = 'login.html';
    return;
  }
  if (!canWrite()) {
    $('#app').innerHTML = notice('기자 권한이 없는 계정입니다. 관리자에게 문의하세요.', true);
    return;
  }
  const admin = isAdmin();
  const mine = admin ? state.articles : state.articles.filter(isMine);
  // 관리자에게는 승인 대기, 학생 기자에게는 수정 요청 개수를 메뉴에 보여 준다
  const waiting = mine.filter(a => a.status === (admin ? 'pending' : 'rejected')).length;
  const waitingLabel = waiting ? ` (${admin ? '승인 대기' : '수정 요청'} ${waiting})` : '';
  $('#app').innerHTML = `<div class="page-head">
      <div>
        <h1>${admin ? '편집국 관리자' : '나의 기자실'}</h1>
        <small>${esc(state.profile?.display_name || '기자')}님, 환영합니다.</small>
      </div>
      <div class="actions">
        <button class="btn" id="new">+ 새 기사 작성</button>
      </div>
    </div>
    <div class="dashboard">
      <aside class="side">
        <strong>기자실 메뉴</strong>
        <button id="articlesTab">기사 관리${waitingLabel}</button>
        ${
          admin
            ? `<button id="catsTab">카테고리 관리</button>
        <button id="designTab">사이트 디자인 설정</button>
        <button id="usersTab">가입 승인</button>
        <button id="membersTab">회원 관리</button>`
            : ''
        }
        <p class="small muted">기사 발행 전 관리자 승인이 필요합니다.</p>
      </aside>
      <section id="workspace">
        <h2>기사 목록 (${mine.length})</h2>
        ${mine.length ? mine.map(entry).join('') : '<p class="muted">아직 작성한 기사가 없습니다.</p>'}
      </section>
    </div>`;

  $('#new').onclick = () => {
    location.hash = '/new';
  };
  $('#articlesTab').onclick = dashboard;
  if (admin) {
    $('#catsTab').onclick = categoryEditor;
    $('#designTab').onclick = designEditor;
    $('#usersTab').onclick = signupRequests;
    $('#membersTab').onclick = members;
    showSignupCount();
  }
  showStats();
  onClick('[data-edit]', b => {
    location.hash = '/edit/' + b.dataset.edit;
  });
  for (const action of Object.keys(ARTICLE_ACTIONS)) {
    onClick(`[data-${action}]`, b => changeArticle(b.dataset[action], action));
  }
}

// 가입 승인 메뉴에 기다리는 신청 수를 붙인다. 못 불러오면 그냥 둔다
async function showSignupCount() {
  const { count } = await db
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('approval_status', 'pending');
  if (count && $('#usersTab')) $('#usersTab').textContent = `가입 승인 (${count})`;
}

// 발행된 기사 옆에 조회수·좋아요를 붙인다
async function showStats() {
  const stats = await articleStats();
  document.querySelectorAll('[data-stats]').forEach(el => {
    const s = stats.get(el.dataset.stats) || { views: 0, likes: 0 };
    el.textContent = ` · 조회 ${s.views.toLocaleString('ko-KR')} · 좋아요 ${s.likes.toLocaleString('ko-KR')}`;
  });
}

function entry(a) {
  const admin = isAdmin();
  return `<div class="entry">
    <div>
      <span class="status">${statusName[a.status] || esc(a.status)}</span> <span class="eyebrow">${esc(a.category)}</span>
      <h3>${esc(a.title)}</h3>
      <div class="meta">${esc(a.author_name)} · ${date(a.updated_at)}${a.status === 'published' ? `<span data-stats="${a.id}"></span>` : ''}</div>
      ${a.status === 'rejected' && a.review_note ? `<p class="review-note">수정 요청: ${esc(a.review_note)}</p>` : ''}
    </div>
    <div class="actions">
      <button class="btn secondary" data-edit="${a.id}">수정</button>
      ${admin && a.status !== 'published' ? `<button class="btn" data-publish="${a.id}">승인·발행</button>` : ''}
      ${admin && a.status === 'published' ? `<button class="btn secondary" data-unpublish="${a.id}">공개 취소</button>` : ''}
      ${admin && a.status === 'pending' ? `<button class="btn secondary" data-reject="${a.id}">수정 요청</button>` : ''}
      <button class="btn danger" data-delete="${a.id}">삭제</button>
    </div>
  </div>`;
}

async function changeArticle(id, action) {
  const { confirm: question, ask, fields } = ARTICLE_ACTIONS[action];
  let note = null;
  if (ask) {
    const answer = prompt(ask);
    if (answer === null) return;
    note = answer.trim().slice(0, 500) || null;
  } else if (!confirm(question)) return;
  const article = state.articles.find(a => a.id === id);
  const table = db.from('articles');
  const { error } = await (fields ? table.update(fields(note)) : table.delete()).eq('id', id);
  if (error) {
    alert(errorText(error));
    return;
  }
  if (action === 'delete') await removePhoto(article?.cover_url);
  await loadArticles();
  dashboard();
}
