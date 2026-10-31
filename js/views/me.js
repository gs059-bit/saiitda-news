// 내 정보: 활동 요약, 활동·댓글·좋아요 내역, 내 기사 조회수, 비밀번호 바꾸기 (#/me)
import { ready, db } from '../supabase.js';
import { $, esc, date, errorText, onClick } from '../utils.js';
import { roleLabel } from '../roles.js';
import { state, canWrite, isMine } from '../state.js';
import { notice } from '../ui.js';
import { articleStats } from '../stats.js';

const TABS = { activity: '활동 내역', comments: '댓글 내역', likes: '좋아요 내역', articles: '내 기사' };
const statusName = { draft: '임시 저장', pending: '승인 대기', published: '발행됨', rejected: '수정 요청' };

let tab = 'activity';
let data = null; // { comments, likes, articles, stats } — 탭을 바꿀 때는 다시 불러오지 않는다

export async function me() {
  if (!state.session) {
    location.href = 'login.html';
    return;
  }
  const { profile, session } = state;
  $('#app').innerHTML = `<div class="page-head">
      <div>
        <h1>내 정보</h1>
        <small>${esc(profile?.display_name || '회원')}님 · ${roleLabel[profile?.role] || roleLabel.student}</small>
      </div>
    </div>
    <div id="meSummary"></div>
    <div id="meTabs" class="actions tabs"></div>
    <section id="meList"><p class="muted">불러오는 중…</p></section>
    <div class="panel">
      <h2>계정</h2>
      <p class="small muted">이메일 ${esc(session.user.email)} · 가입 ${date(session.user.created_at)}<br>
      이름을 바꾸려면 관리자에게 요청해 주세요.</p>
      <form id="pwform">
        <div class="field">
          <label for="newpass">새 비밀번호</label>
          <input id="newpass" type="password" required minlength="8" autocomplete="new-password">
        </div>
        <div class="field">
          <label for="newpass2">새 비밀번호 확인</label>
          <input id="newpass2" type="password" required minlength="8" autocomplete="new-password">
        </div>
        <button class="btn" type="submit">비밀번호 바꾸기</button>
        <div id="pwmsg"></div>
      </form>
    </div>`;
  $('#pwform').onsubmit = changePassword;
  data = await load();
  if (!$('#meList')) return; // 불러오는 사이 다른 화면으로 이동함
  summary();
  tabs();
}

async function load() {
  const uid = state.session.user.id;
  const empty = { data: [] };
  const [comments, likes, stats] = ready
    ? await Promise.all([
        db
          .from('comments')
          .select('id,article_id,content,created_at')
          .eq('author_id', uid)
          .order('created_at', { ascending: false })
          .limit(200),
        db
          .from('article_likes')
          .select('article_id,created_at')
          .eq('user_id', uid)
          .order('created_at', { ascending: false })
          .limit(200),
        articleStats()
      ])
    : [empty, empty, new Map()];
  return {
    comments: comments.data || [],
    likes: likes.data || [],
    articles: canWrite() ? state.articles.filter(isMine) : [],
    stats
  };
}

const statOf = id => data.stats.get(id) || { views: 0, likes: 0 };
const title = id => state.articles.find(a => a.id === id)?.title;
// 발행 전이거나 지워진 기사는 목록에 없으므로 제목 대신 안내를 보인다
const articleLink = id =>
  title(id) ? `<a href="#/article/${esc(id)}">${esc(title(id))}</a>` : '<span class="muted">볼 수 없는 기사</span>';

function summary() {
  const { comments, likes, articles } = data;
  const tiles = [
    ...(canWrite()
      ? [
          ['쓴 기사', articles.length],
          ['받은 조회수', articles.reduce((n, a) => n + statOf(a.id).views, 0)],
          ['받은 좋아요', articles.reduce((n, a) => n + statOf(a.id).likes, 0)]
        ]
      : []),
    ['쓴 댓글', comments.length],
    ['누른 좋아요', likes.length]
  ];
  $('#meSummary').innerHTML = `<div class="stat-tiles">${tiles
    .map(
      ([label, n]) => `<div class="stat-tile"><strong>${n.toLocaleString('ko-KR')}</strong><span>${label}</span></div>`
    )
    .join('')}</div>`;
}

function tabs() {
  const shown = Object.entries(TABS).filter(([k]) => k !== 'articles' || canWrite());
  if (!shown.some(([k]) => k === tab)) tab = 'activity';
  $('#meTabs').innerHTML = shown
    .map(
      ([k, label]) =>
        `<button class="btn small ${k === tab ? '' : 'secondary'}" data-tab="${k}" aria-pressed="${k === tab}">${label}</button>`
    )
    .join('');
  onClick(
    '[data-tab]',
    b => {
      tab = b.dataset.tab;
      tabs();
    },
    $('#meTabs')
  );
  $('#meList').innerHTML = LISTS[tab]();
}

const item = (kind, body, meta) => `<div class="entry"><div>
    <span class="status">${kind}</span>
    <h3>${body}</h3>
    <div class="meta">${meta}</div>
  </div></div>`;

const listOrEmpty = (rows, text) => (rows.length ? rows.join('') : `<p class="muted">${text}</p>`);

const LISTS = {
  // 기사 작성·발행, 댓글, 좋아요를 시간순으로 섞어 최근 50개
  activity() {
    const events = [
      ...data.articles.map(a => ({ at: a.created_at, kind: '기사 작성', id: a.id })),
      ...data.articles.filter(a => a.published_at).map(a => ({ at: a.published_at, kind: '기사 발행', id: a.id })),
      ...data.comments.map(c => ({ at: c.created_at, kind: '댓글', id: c.article_id, text: c.content })),
      ...data.likes.map(l => ({ at: l.created_at, kind: '좋아요', id: l.article_id }))
    ]
      .sort((x, y) => new Date(y.at) - new Date(x.at))
      .slice(0, 50);
    return listOrEmpty(
      events.map(e => item(e.kind, articleLink(e.id), (e.text ? esc(e.text) + ' · ' : '') + date(e.at))),
      '아직 활동이 없어요. 기사를 읽고 댓글이나 좋아요를 남겨 보세요.'
    );
  },
  comments() {
    return listOrEmpty(
      data.comments.map(c => item('댓글', articleLink(c.article_id), `${esc(c.content)} · ${date(c.created_at)}`)),
      '아직 쓴 댓글이 없어요.'
    );
  },
  likes() {
    return listOrEmpty(
      data.likes.map(l => item('좋아요', articleLink(l.article_id), date(l.created_at))),
      '아직 좋아요를 누른 기사가 없어요.'
    );
  },
  // 조회수는 발행된 기사만 센다
  articles() {
    return listOrEmpty(
      data.articles.map(a => {
        const s = statOf(a.id);
        const link = a.status === 'published' ? articleLink(a.id) : esc(a.title);
        return item(
          statusName[a.status] || esc(a.status),
          link,
          `조회 ${s.views.toLocaleString('ko-KR')} · 좋아요 ${s.likes.toLocaleString('ko-KR')} · ${date(a.published_at || a.created_at)}`
        );
      }),
      '아직 쓴 기사가 없어요.'
    );
  }
};

async function changePassword(e) {
  e.preventDefault();
  const password = $('#newpass').value;
  if (password !== $('#newpass2').value) {
    $('#pwmsg').innerHTML = notice('비밀번호와 비밀번호 확인이 서로 다릅니다.', true);
    return;
  }
  const btn = $('#pwform button');
  btn.disabled = true;
  const { error } = await db.auth.updateUser({ password });
  btn.disabled = false;
  if (error) {
    $('#pwmsg').innerHTML = notice(`비밀번호를 바꿀 수 없습니다. (${errorText(error)})`, true);
    return;
  }
  $('#pwform').reset();
  $('#pwmsg').innerHTML = notice('비밀번호를 바꿨습니다. 다음 로그인부터 새 비밀번호를 쓰세요.');
}
