// 기사 읽기 화면과 댓글
import { ready, db } from '../supabase.js';
import { $, esc, date, errorText, onClick } from '../utils.js';
import { roleLabel } from '../roles.js';
import { state, isAdmin, canWrite, canModerate, isMine } from '../state.js';
import { notice, byline, notFound } from '../ui.js';
import { recordView } from '../stats.js';

const roleEmoji = { admin: '👑', teacher: '🍎', reporter: '✏️', student: '🙂' };
const emojis = ['😀', '😂', '😍', '👍', '👏', '🎉', '😮', '🤔'];
const commentState = { pending: '승인 대기 중', rejected: '숨김' };

export function articleView(id) {
  const a = state.articles.find(x => x.id === id);
  // 발행 전 기사는 관리자와 글쓴이만 볼 수 있다
  if (!a || (a.status !== 'published' && !isAdmin() && !isMine(a))) {
    notFound();
    return;
  }
  const canEdit = canWrite() && (isAdmin() || isMine(a));
  $('#app').innerHTML = `<article class="article">
    <div class="eyebrow">${esc(a.category)}</div>
    <h1>${esc(a.title)}</h1>
    <p class="lead">${esc(a.summary)}</p>
    <div class="byline">${byline(a)}</div>
    ${a.cover_url ? `<img class="cover" src="${esc(a.cover_url)}" alt="기사 대표 사진">` : ''}
    <div class="body">${esc(a.body)}</div>
    <div class="actions" style="margin-top:28px">
      <button class="btn secondary" id="back">기사 목록으로</button>
      ${canEdit ? '<button class="btn" id="edit">기사 수정</button>' : ''}
      <span id="likes"></span>
    </div>
    <section class="comments" id="comments" aria-label="댓글"></section>
  </article>`;
  $('#back').onclick = () => {
    location.hash = '/';
  };
  if (canEdit)
    $('#edit').onclick = () => {
      location.hash = '/edit/' + a.id;
    };
  if (a.status === 'published') {
    if (!isMine(a)) recordView(a.id);
    loadLikes(a.id);
    loadComments(a.id);
  }
}

// 좋아요 표(database/likes-views.sql)가 아직 없으면 버튼을 보이지 않는다
async function loadLikes(id) {
  if (!ready) return;
  const { data, error } = await db.from('article_likes').select('user_id').eq('article_id', id);
  if (error || !$('#likes')) return;
  const uid = state.session?.user?.id;
  const liked = data.some(l => l.user_id === uid);
  $('#likes').innerHTML = `<button class="btn secondary like${liked ? ' on' : ''}" id="likeBtn" aria-pressed="${liked}">
    ${liked ? '♥' : '♡'} 좋아요 ${data.length}</button>`;
  $('#likeBtn').onclick = async () => {
    if (!uid) {
      location.href = 'login.html';
      return;
    }
    $('#likeBtn').disabled = true;
    const table = db.from('article_likes');
    const { error } = liked
      ? await table.delete().eq('article_id', id).eq('user_id', uid)
      : await table.insert({ article_id: id });
    if (error) alert(errorText(error));
    loadLikes(id);
  };
}

// author_name·author_role 칸이 아직 없으면(database/comments-author.sql 실행 전) 기본 칸만 불러온다
async function loadComments(id) {
  if (!ready) return;
  const query = cols => db.from('comments').select(cols).eq('article_id', id).order('created_at');
  let { data, error } = await query('id,author_id,author_name,author_role,content,status,created_at');
  if (error) ({ data, error } = await query('id,author_id,content,status,created_at'));
  if (!$('#comments')) return; // 불러오는 사이 다른 화면으로 이동함
  if (error) {
    $('#comments').innerHTML = '';
    return;
  }
  renderComments(id, data || []);
}

function commentItem(c) {
  const role = c.author_role;
  return `<div class="comment">
    <div class="chead">
      <span class="cname">${esc(c.author_name || '회원')}</span>
      ${roleEmoji[role] ? `<span class="badge ${role}">${roleEmoji[role]} ${roleLabel[role]}</span>` : ''}
      <span>${date(c.created_at)}</span>
      ${commentState[c.status] ? `<span class="cstate">${commentState[c.status]}</span>` : ''}
      ${canModerate() ? `<button class="btn danger small" data-cdelete="${c.id}">삭제</button>` : ''}
    </div>
    <p class="cbody">${esc(c.content)}</p>
  </div>`;
}

function commentForm() {
  if (!state.session)
    return '<p class="cform"><a class="btn secondary" href="login.html">로그인하고 댓글 남기기</a></p>';
  return `<form class="cform" id="cform">
    <label for="ctext" class="small muted">댓글은 바로 공개됩니다. 서로를 존중하는 말로 써 주세요.</label>
    <textarea id="ctext" maxlength="300" required placeholder="기사에 대한 생각을 남겨 주세요."></textarea>
    <div class="cfoot">
      <div class="emojis" aria-label="이모티콘 넣기">${emojis.map(e => `<button type="button" data-emoji="${e}" aria-label="${e} 넣기">${e}</button>`).join('')}</div>
      <button class="btn" id="csubmit">댓글 등록</button>
    </div>
    <div id="cmsg"></div>
  </form>`;
}

function renderComments(id, list) {
  const shown = list.filter(c => c.status === 'approved').length;
  $('#comments').innerHTML = `<h2>댓글 ${shown}</h2>
    ${list.length ? list.map(commentItem).join('') : '<p class="muted">첫 번째 댓글을 남겨 주세요.</p>'}
    ${commentForm()}`;

  onClick('[data-emoji]', b => {
    const t = $('#ctext');
    t.setRangeText(b.dataset.emoji, t.selectionStart, t.selectionEnd, 'end');
    t.focus();
  });

  onClick('[data-cdelete]', async b => {
    if (!confirm('이 댓글을 삭제할까요?')) return;
    const { data, error } = await db.from('comments').delete().eq('id', b.dataset.cdelete).select('id');
    // 권한이 없으면 오류 없이 0개가 지워지므로 지워진 개수로 확인한다
    if (error) alert(errorText(error));
    else if (!data.length) alert('댓글을 삭제할 권한이 없습니다.');
    else loadComments(id);
  });

  if (!$('#cform')) return;
  $('#cform').onsubmit = async e => {
    e.preventDefault();
    const content = $('#ctext').value.trim();
    if (!content) return;
    const btn = $('#csubmit');
    btn.disabled = true;
    const { error } = await db
      .from('comments')
      .insert({ article_id: id, author_id: state.session.user.id, content, status: 'approved' });
    btn.disabled = false;
    if (error) {
      $('#cmsg').innerHTML = notice(errorText(error), true);
      return;
    }
    loadComments(id);
  };
}
