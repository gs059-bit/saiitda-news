export const $ = s => document.querySelector(s);

// HTML 문자열에 넣는 사용자 입력은 반드시 esc()를 거친다
export const esc = s =>
  String(s ?? '').replace(
    /[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );

export const date = s =>
  s ? new Date(s).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }) : '';

export const errorText = e => e?.message || '오류가 발생했습니다.';

// selector에 맞는 요소마다 클릭 핸들러를 단다. handler(요소, 이벤트)
export function onClick(selector, handler, root = document) {
  root.querySelectorAll(selector).forEach(el => {
    el.onclick = e => handler(el, e);
  });
}
