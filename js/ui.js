// 여러 화면에서 쓰는 HTML 조각
import { $, esc, date, onClick } from './utils.js';
import { state } from './state.js';
import { CATEGORY_INFO } from './categories.js';

export function notice(msg, bad = false) {
  return `<div class="notice ${bad ? 'error' : ''}">${esc(msg)}</div>`;
}

const paperIcon = '<rect x="4" y="5" width="16" height="14" rx="1"/><path d="M8 9h8M8 12h8M8 15h5"/>';
const svg = (paths, size) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

// 기자 이름 · 날짜
export const byline = a => `${esc(a.author_name || '사이잇다 신문부')} · ${date(a.published_at || a.created_at)}`;

// 대표 사진이 없으면 카테고리 색과 아이콘으로 채운다
function photo(a) {
  if (a.cover_url) return `<img loading="lazy" src="${esc(a.cover_url)}" alt="기사 대표 사진">`;
  const info = CATEGORY_INFO[a.category];
  return `<div class="noimg" style="background:${info?.tint || '#eceef1'}">${svg(info?.icon || paperIcon, 44)}</div>`;
}

export function card(a, feature = false) {
  return `<div class="story${feature ? ' feature' : ''}" role="link" tabindex="0" data-article="${a.id}">
    <div class="thumb">${photo(a)}</div>
    <div class="eyebrow">${esc(a.category)}</div>
    <h3>${esc(a.title)}</h3>
    <p class="summary">${esc(a.summary || '')}</p>
    <div class="meta">${byline(a)}</div>
  </div>`;
}

// 메인 맨 위 "이번 호" 대표 기사
export function lead(a) {
  const issue = state.siteSettings.issue ? ' · ' + esc(state.siteSettings.issue) : '';
  return `<section class="hero" role="link" tabindex="0" data-article="${a.id}" aria-label="이번 호 대표 기사">
    <div class="thumb">${photo(a)}</div>
    <div class="leadtext">
      <div class="eyebrow">이번 호${issue} · ${esc(a.category)}</div>
      <h2>${esc(a.title)}</h2>
      <p class="summary">${esc(a.summary || '')}</p>
      <div class="meta">${byline(a)}</div>
      <span class="more">기사 읽기 →</span>
    </div>
  </section>`;
}

// card()·lead()로 그린 요소를 누르거나 Enter를 치면 기사로 이동
export function wireCards() {
  onClick('[data-article]', el => {
    location.hash = '/article/' + el.dataset.article;
  });
  document.querySelectorAll('[data-article]').forEach(el => {
    el.onkeydown = e => {
      if (e.key === 'Enter') el.click();
    };
  });
}

export function skeleton() {
  const item =
    '<div class="story sk"><div class="thumb"></div><div class="skl"></div><div class="skl"></div><div class="skl short"></div></div>';
  return `<div class="grid" aria-label="기사를 불러오는 중">${item.repeat(3)}</div>`;
}

export function emptyBox(title, text) {
  return `<div class="empty">${svg(paperIcon + '<path d="M17 3l3 3-6 6h-3v-3z"/>', 56)}<h2>${title}</h2><p>${text}</p></div>`;
}

export function notFound() {
  $('#app').innerHTML = `<div class="empty">
    <h2>페이지를 찾을 수 없어요.</h2>
    <p>주소를 확인하거나 홈으로 돌아가 주세요.</p>
    <a href="#/" class="btn">홈으로</a>
  </div>`;
}
