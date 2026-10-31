// 메인: 기사 목록, 카테고리별 구역, 검색
import { ready } from '../supabase.js';
import { $, esc, onClick } from '../utils.js';
import { ALL, CATEGORY_INFO } from '../categories.js';
import { state, published } from '../state.js';
import { notice, card, lead, wireCards, skeleton, emptyBox } from '../ui.js';
import { render } from '../app.js';

const time = a => new Date(a.published_at || a.created_at);

export function home() {
  const desc = CATEGORY_INFO[state.currentCat]?.desc;
  $('#app').innerHTML = `<div class="page-head">
      <div>
        <h1>${esc(state.currentCat)}</h1>
        ${desc ? `<p class="catdesc">${esc(desc)}</p>` : ''}
        <small id="count"></small>
      </div>
      <input class="search" id="search" aria-label="기사 검색" placeholder="기사 제목이나 내용 검색" value="${esc(state.search)}">
    </div>
    ${ready ? '' : notice('현재는 설정 전 미리보기입니다. config.js에 Supabase 정보를 입력하면 기사 발행과 로그인이 활성화됩니다.')}
    <div id="results"></div>`;
  $('#search').oninput = e => {
    state.search = e.target.value;
    homeList();
  };
  homeList();
}

// 검색할 때마다 목록 부분만 다시 그린다(검색창 포커스를 유지하려고)
function homeList() {
  if (state.loading) {
    $('#count').textContent = '';
    $('#results').innerHTML = skeleton();
    return;
  }
  const { currentCat, categories, siteSettings } = state;
  const search = state.search.toLowerCase();
  const items = published()
    .filter(a => currentCat === ALL || a.category === currentCat)
    .filter(a => !search || [a.title, a.summary, a.body, a.author_name].join(' ').toLowerCase().includes(search))
    .sort((a, b) => time(b) - time(a));
  $('#count').textContent = `기사 ${items.length}개 · 최신순`;

  let html;
  if (!items.length) {
    html = search
      ? emptyBox('찾는 기사가 없어요.', '다른 낱말로 검색해 보세요.')
      : emptyBox('아직 등록된 기사가 없어요.', '신문부의 첫 번째 기사가 발행되면 이곳에 나타납니다.');
  } else if (currentCat === ALL && !search) {
    // 전체기사 첫 화면: 대표 기사 + 카테고리별 최신 3개 + 목록에 없는 카테고리의 기사
    const top = items.find(a => a.id === siteSettings.featured_id) || items[0];
    const rest = items.filter(a => a !== top);
    const other = rest.filter(a => !categories.includes(a.category));
    html =
      lead(top) +
      categories
        .map(c => {
          const list = rest.filter(a => a.category === c);
          return list.length ? section(c, list, CATEGORY_INFO[c]?.desc) : '';
        })
        .join('') +
      (other.length ? section('그 밖의 기사', other) : '');
  } else {
    html = `<div class="grid">${items.map((a, i) => card(a, i === 0 && items.length >= 3)).join('')}</div>`;
  }

  $('#results').innerHTML = html;
  onClick(
    '[data-more]',
    b => {
      state.currentCat = b.dataset.more;
      render();
      $('.nav').scrollIntoView({ behavior: 'smooth' });
    },
    $('#results')
  );
  wireCards();
}

function section(name, list, desc) {
  const more = state.categories.includes(name)
    ? `<button class="btn secondary small" data-more="${esc(name)}">더 보기 →</button>`
    : '';
  return `<section class="catsec">
    <div class="cathead">
      <div><h2>${esc(name)}</h2>${desc ? `<p>${esc(desc)}</p>` : ''}</div>
      ${more}
    </div>
    <div class="grid">${list
      .slice(0, 3)
      .map(a => card(a))
      .join('')}</div>
  </section>`;
}
