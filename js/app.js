// index.html 진입점: 상단 바·카테고리 메뉴를 그리고, 주소(#/...)에 맞는 화면을 띄운다
import { cfg, ready, db, school } from './supabase.js';
import { $, esc } from './utils.js';
import { roleLabel } from './roles.js';
import { ALL } from './categories.js';
import { state, canWrite, loadProfile, loadCategories, loadSettings, loadArticles } from './state.js';
import { notFound } from './ui.js';
import { showWeather } from './weather.js';
import { home } from './views/home.js';
import { articleView } from './views/article.js';
import { dashboard } from './views/dashboard.js';
import { editor, clearDrafts } from './views/editor.js';
import { me } from './views/me.js';

const routes = [
  [/^\/$/, home],
  [/^\/login$/, () => location.replace('login.html')],
  [/^\/dashboard$/, dashboard],
  [/^\/new$/, () => editor()],
  [/^\/edit\/([^/]*)/, id => editor(id)],
  [/^\/article\/([^/]*)/, id => articleView(id)],
  [/^\/me$/, me]
];

const route = () => decodeURIComponent(location.hash.slice(1) || '/');

export function render() {
  nav();
  const path = route();
  // 홈에서는 주소 뒤의 #/ 와 ?utm_source=... 같은 꼬리를 지워 깔끔한 주소만 남긴다
  if (path === '/' && (location.hash || location.search)) history.replaceState(null, '', location.pathname);
  for (const [pattern, view] of routes) {
    const m = path.match(pattern);
    if (m) {
      view(m[1]);
      return;
    }
  }
  notFound();
}

export function nav() {
  const { session, profile, categories, currentCat } = state;
  $('#nav').innerHTML = [ALL, ...categories]
    .map(c => `<button class="${currentCat === c ? 'active' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`)
    .join('');
  $('#nav')
    .querySelectorAll('[data-cat]')
    .forEach(b => {
      b.onclick = () => {
        state.currentCat = b.dataset.cat;
        location.hash = '/';
        render();
      };
    });

  // 비로그인: 로그인 / 로그인: 내 정보 · (기자·관리자만) 기자실 · 로그아웃
  const authBtn = $('#authBtn');
  authBtn.hidden = Boolean(session) && !canWrite();
  authBtn.textContent = session ? '기자실' : '로그인';
  authBtn.onclick = () => {
    if (session) location.hash = '/dashboard';
    else location.href = 'login.html';
  };
  $('#meBtn').hidden = !session;
  $('#meBtn').onclick = () => {
    location.hash = '/me';
  };
  $('#logoutBtn').hidden = !session;
  $('#logoutBtn').onclick = logout;
  $('#userbar').textContent = session
    ? `${profile?.display_name || '회원'}님 · ${roleLabel[profile?.role] || roleLabel.student}`
    : '';
}

// 로그아웃할 때 이 사람의 보관 글도 지운다(학교 컴퓨터를 여럿이 쓰므로)
export async function logout() {
  clearDrafts();
  await db.auth.signOut();
  location.hash = '/';
}

async function init() {
  // 학교 이름이 들어가는 곳(index.html의 data-school)은 모두 config.js의 schoolName을 따른다
  document.querySelectorAll('[data-school]').forEach(el => {
    el.textContent = school;
  });
  $('#emblem').alt = `${school} 교표`;
  document.querySelector('meta[name=description]').content = `${school} 어린이 기자단 웹진 사이잇다`;
  $('#year').textContent = new Date().getFullYear();
  $('#footContact').textContent = cfg.contact || '';
  $('#tagline').textContent = cfg.tagline || '';
  showWeather(); // 기다리지 않는다. 실패하면 날씨 칸만 숨겨진 채로 남는다
  // 홈은 데이터를 기다리지 않고 먼저 그린다(다른 화면은 로그인 정보가 필요해 기다린다)
  if (route() === '/') render();
  if (ready) {
    try {
      const { data } = await db.auth.getSession();
      state.session = data.session;
      await Promise.all([loadProfile(), loadCategories(), loadSettings(), loadArticles()]);
      db.auth.onAuthStateChange((_event, s) => {
        state.session = s;
        // 콜백 안에서 Supabase를 바로 부르면 교착될 수 있어 한 박자 미룬다
        setTimeout(async () => {
          await loadProfile();
          await loadArticles();
          render();
        }, 0);
      });
    } catch (e) {
      console.error(e);
    }
  }
  state.loading = false;
  render();
  window.addEventListener('hashchange', render);
}

init();
