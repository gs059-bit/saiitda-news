// 디자인 시안 생성기: node prototypes/build.mjs  (사이트 본체와 무관한 미리보기용)
// 로고·메뉴 이미지는 원본 파일(../logo.jpg, ../menu-*.png)을 그대로 쓴다
import { writeFileSync } from 'node:fs';

const menus = [
  ['menu-all.png', '전체기사'], ['menu-us.png', '우리를 잇다'], ['menu-today.png', '오늘의 사이'],
  ['menu-world.png', '세상을 잇다'], ['menu-books.png', '책 사이를 잇다'], ['menu-heart.png', '마음을 잇다'],
  ['menu-people.png', '사이를 잇는 사람들']
];
const cats = {
  '우리를 잇다': ['#f59e0b', '#fff3dc'], '오늘의 사이': ['#eab308', '#fff8cc'], '세상을 잇다': ['#16a34a', '#e0f5e8'],
  '책 사이를 잇다': ['#7c5cd6', '#ece6fa'], '마음을 잇다': ['#e0527a', '#fde4ec']
};
const samples = [
  ['우리를 잇다', '우리 반 친구들의 꿈 이야기', '장래희망을 주제로 3학년 친구들을 인터뷰했어요. 의사, 축구선수, 유튜버까지 다양한 꿈이 있었답니다.', '김하늘 기자 · 11월 1일'],
  ['오늘의 사이', '운동장에 가을이 왔어요', '단풍잎이 가득한 운동장에서 친구들이 낙엽 놀이를 했습니다. 사진으로 그날의 모습을 담았어요.', '이도윤 기자 · 10월 30일'],
  ['세상을 잇다', '우리 동네 재활용, 어떻게 할까?', '분리배출을 제대로 하면 지구가 건강해져요. 기자가 직접 알아본 올바른 분리배출 방법!', '박서연 기자 · 10월 28일'],
  ['책 사이를 잇다', '이번 달 추천 도서 3권', '도서관 선생님께 여쭤본 5학년 친구들에게 인기 있는 책을 소개합니다.', '최민준 기자 · 10월 27일'],
  ['마음을 잇다', '교장 선생님께 물어봤어요', '"학교에서 가장 행복한 순간은 언제인가요?" 교장 선생님과 나눈 따뜻한 이야기를 전합니다.', '정유나 기자 · 10월 25일']
];
const card = ([c, t, s, m]) => `
  <article class="card" style="--c:${cats[c][0]};--t:${cats[c][1]}">
    <div class="thumb"><span>샘플 사진</span></div>
    <div class="body"><span class="tag">${c}</span><h3>${t}</h3><p>${s}</p><small>${m}</small></div>
  </article>`;

const page = (title, fontLink, css, extraTop = '') => `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="stylesheet" href="${fontLink}">
<style>
*{box-sizing:border-box}body{margin:0}img{max-width:100%}a{color:inherit;text-decoration:none}button{font:inherit;cursor:pointer}
.wrap{max-width:1120px;margin:0 auto;padding:0 20px}
.nav{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:12px;max-width:1080px;margin:0 auto;padding:18px 12px}
.nav button{border:0;background:none;padding:0}.nav img{display:block;width:100%;aspect-ratio:900/560;object-fit:contain}
.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}
@media(max-width:900px){.grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:700px){.nav{grid-template-columns:repeat(4,1fr)}.hero{grid-template-columns:1fr!important}}
@media(max-width:560px){.grid{grid-template-columns:1fr}}
.note{position:fixed;right:12px;bottom:12px;background:#111c;color:#fff;font:12px sans-serif;padding:6px 10px;border-radius:20px;z-index:9}
${css}
</style></head><body>
<div class="note">시안 · 샘플 내용</div>
<div class="util"><div class="wrap utilin"><span class="brand"><img src="../school-emblem.png" alt="" height="30"> <b>강서초등학교</b> <small>어린이 기자단 웹진</small></span><span><button class="pill">로그인</button></span></div></div>
${extraTop}
<header class="mast wrap"><a href="#"><img class="logo" src="../logo.jpg" alt="사이잇다" width="849" height="255"></a><p class="sub">학생 기자들이 직접 취재하고 기록하는 우리 학교의 이야기</p></header>
<nav class="navbar"><div class="nav">${menus.map(([f, n]) => `<button aria-label="${n}"><img src="../${f}" alt="${n}"></button>`).join('')}</div></nav>
<main class="wrap">
  <section class="hero" style="--c:${cats['우리를 잇다'][0]};--t:${cats['우리를 잇다'][1]}">
    <div class="thumb"><span>샘플 사진</span></div>
    <div class="lead"><span class="tag">이번 호 대표 기사</span><h2>${samples[0][1]}</h2><p>${samples[0][2]}</p><small>${samples[0][3]}</small><a class="more" href="#">기사 읽기 →</a></div>
  </section>
  <div class="sechead"><h2>새로 올라온 기사</h2><span>더 보기 →</span></div>
  <div class="grid">${samples.slice(1).concat([samples[0]]).map(s => card(s)).join('')}</div>
</main>
<footer class="foot"><div class="wrap">사이잇다 · 강서초등학교 어린이 기자단 웹진<br>기사에 등장하는 학생의 사진과 개인정보는 게시 전 학교 지침에 따라 확인합니다. · 개인정보처리방침</div></footer>
</body></html>`;

// ───────── 시안 A: 맑은 하늘 (밝고 둥근, 친근한 느낌) ─────────
const A = `
body{background:linear-gradient(#e6f4ff 0,#f7fbff 420px,#fff 100%);color:#23364a;font-family:'Gowun Dodum',sans-serif;line-height:1.6}
.util{background:#fff;border-bottom:1px solid #d9eaf7}.utilin{display:flex;justify-content:space-between;align-items:center;min-height:56px}
.brand{display:flex;align-items:center;gap:8px}.brand small{color:#6b8299}
.pill{border:2px solid #0067bd;background:#fff;color:#0067bd;border-radius:999px;padding:7px 18px;font-weight:700}
.mast{text-align:center;padding-top:22px}.logo{width:min(560px,80%);height:auto;border-radius:22px;box-shadow:0 10px 26px #0067bd33}
.sub{color:#4d6a86;margin:12px 0 0;font-size:16px}
.navbar{margin:6px 0 10px}.nav button{border-radius:16px;transition:transform .2s}.nav button:hover{transform:translateY(-5px) rotate(-1.5deg)}
.hero{display:grid;grid-template-columns:1.1fr 1fr;background:#fff;border-radius:28px;overflow:hidden;box-shadow:0 14px 40px #0067bd22;border:3px solid #fff}
.thumb{background:linear-gradient(135deg,var(--t),#fff);display:grid;place-items:center;color:var(--c);font-weight:700;min-height:220px}
.lead{padding:36px;display:flex;flex-direction:column;justify-content:center;gap:10px}
.lead h2{font-size:clamp(26px,3.4vw,38px);margin:0;line-height:1.35;color:#16324f}.lead p{margin:0;font-size:17px;color:#4d6a86}
.tag{align-self:flex-start;background:var(--t);color:var(--c);font-weight:800;font-size:13px;padding:5px 12px;border-radius:999px}
.more{align-self:flex-start;margin-top:8px;background:#0067bd;color:#fff;padding:12px 24px;border-radius:999px;font-weight:800;box-shadow:0 6px 14px #0067bd44}
.sechead{display:flex;justify-content:space-between;align-items:end;margin:44px 0 16px}.sechead h2{margin:0;font-size:26px;color:#16324f}.sechead span{color:#0067bd;font-weight:700}
.card{background:#fff;border-radius:22px;overflow:hidden;box-shadow:0 8px 24px #23364a14;transition:transform .2s}.card:hover{transform:translateY(-6px)}
.card .thumb{aspect-ratio:4/3;min-height:0}.card .body{padding:18px 20px 22px;display:flex;flex-direction:column;gap:8px}
.card h3{margin:0;font-size:20px;color:#16324f;line-height:1.4}.card p{margin:0;color:#5d768f;font-size:15px}.card small{color:#8aa0b5}
.foot{margin-top:60px;background:#16324f;color:#cfe0f0;padding:30px 0;font-size:13px;line-height:1.9;text-align:center}
`;

// ───────── 시안 B: 에디토리얼 (단정하고 신뢰감 있는, 공식 보고용) ─────────
const B = `
body{background:#fbfaf7;color:#1b2a3a;font-family:'Gowun Dodum',sans-serif;line-height:1.65}
.util{background:#12294a;color:#e8eef7}.utilin{display:flex;justify-content:space-between;align-items:center;min-height:50px;font-size:14px}
.brand{display:flex;align-items:center;gap:8px}.brand small{opacity:.7}.pill{border:1px solid #ffffff66;background:none;color:#fff;border-radius:4px;padding:6px 16px}
.mast{text-align:center;padding-top:26px}.logo{width:min(520px,78%);height:auto}
.sub{color:#5b6b7e;margin:10px 0 0;font-size:15px;letter-spacing:.02em}
.navbar{border-block:1px solid #d8d4c8;background:#fff;margin-top:18px}
.nav button{transition:opacity .2s;opacity:.88}.nav button:hover{opacity:1}
.hero{display:grid;grid-template-columns:1.25fr 1fr;margin-top:34px;background:#fff;border:1px solid #e3dfd3;border-top:4px solid #12294a}
.thumb{background:linear-gradient(135deg,var(--t),#fff);display:grid;place-items:center;color:var(--c);font-weight:700;min-height:240px}
.lead{padding:40px;display:flex;flex-direction:column;justify-content:center;gap:12px}
.lead h2{font-family:'Noto Serif KR',serif;font-size:clamp(26px,3.2vw,36px);margin:0;line-height:1.4;letter-spacing:-.02em;color:#12294a}
.lead p{margin:0;color:#4a5a6c;font-size:17px}.lead small{color:#8591a0}
.tag{align-self:flex-start;color:var(--c);font-weight:800;font-size:13px;letter-spacing:.04em;border-bottom:2px solid var(--c);padding-bottom:2px}
.more{align-self:flex-start;color:#12294a;font-weight:800;border-bottom:2px solid #12294a;margin-top:6px}
.sechead{display:flex;justify-content:space-between;align-items:end;margin:48px 0 18px;border-bottom:2px solid #12294a;padding-bottom:8px}
.sechead h2{margin:0;font-family:'Noto Serif KR',serif;font-size:24px;color:#12294a}.sechead span{color:#5b6b7e;font-size:14px}
.card{background:#fff;border:1px solid #e3dfd3;transition:box-shadow .2s}.card:hover{box-shadow:0 10px 26px #12294a1f}
.card .thumb{aspect-ratio:4/3;min-height:0}.card .body{padding:18px 20px 22px;display:flex;flex-direction:column;gap:8px}
.card h3{margin:0;font-family:'Noto Serif KR',serif;font-size:19px;line-height:1.5;color:#12294a}.card p{margin:0;color:#5b6b7e;font-size:14.5px}.card small{color:#98a2ad}
.foot{margin-top:64px;background:#12294a;color:#c5d1e2;padding:30px 0;font-size:13px;line-height:1.9}
`;

// ───────── 시안 C: 알록달록 놀이터 (아이들 눈높이, 큼직하고 재미있게) ─────────
const C = `
body{background:#fffaf0;color:#3a2e22;font-family:'Jua','Gowun Dodum',sans-serif;line-height:1.55;
 background-image:radial-gradient(#ffe2a8 2px,transparent 2px);background-size:28px 28px}
.util{background:#ffd54a}.utilin{display:flex;justify-content:space-between;align-items:center;min-height:56px;font-size:17px}
.brand{display:flex;align-items:center;gap:8px}.brand small{opacity:.7}
.pill{border:3px solid #3a2e22;background:#fff;color:#3a2e22;border-radius:14px;padding:6px 18px;box-shadow:3px 3px 0 #3a2e22;font-family:inherit}
.mast{text-align:center;padding-top:24px}.logo{width:min(560px,82%);height:auto;border-radius:24px;border:4px solid #3a2e22;box-shadow:6px 6px 0 #3a2e22}
.sub{font-size:19px;margin:16px 0 0}
.navbar{margin:8px 0 14px}.nav button{transition:transform .15s}.nav button:hover{transform:scale(1.1) rotate(-3deg)}
.hero{display:grid;grid-template-columns:1.1fr 1fr;background:#fff;border:4px solid #3a2e22;border-radius:28px;overflow:hidden;box-shadow:8px 8px 0 #3a2e22}
.thumb{background:var(--t);display:grid;place-items:center;color:var(--c);font-size:20px;min-height:230px}
.lead{padding:34px;display:flex;flex-direction:column;justify-content:center;gap:10px}
.lead h2{font-size:clamp(28px,3.6vw,42px);margin:0;line-height:1.25}.lead p{margin:0;font-size:19px}
.tag{align-self:flex-start;background:var(--c);color:#fff;font-size:15px;padding:4px 14px;border-radius:999px;border:3px solid #3a2e22}
.more{align-self:flex-start;margin-top:8px;background:#ff7a59;color:#fff;border:3px solid #3a2e22;padding:10px 24px;border-radius:16px;box-shadow:4px 4px 0 #3a2e22;font-size:19px}
.sechead{display:flex;justify-content:space-between;align-items:end;margin:46px 0 18px}.sechead h2{margin:0;font-size:32px}.sechead span{font-size:18px}
.card{background:#fff;border:3px solid #3a2e22;border-radius:22px;overflow:hidden;box-shadow:5px 5px 0 var(--c);transition:transform .15s}.card:hover{transform:translate(-3px,-3px) rotate(-.6deg)}
.card .thumb{aspect-ratio:4/3;min-height:0;border-bottom:3px solid #3a2e22}.card .body{padding:16px 18px 20px;display:flex;flex-direction:column;gap:8px}
.card h3{margin:0;font-size:23px;line-height:1.3}.card p{margin:0;font-size:16px;color:#6b5a48;font-family:'Gowun Dodum',sans-serif}.card small{color:#9b8a76;font-family:'Gowun Dodum',sans-serif}
.foot{margin-top:60px;background:#3a2e22;color:#ffe9b8;padding:30px 0;font-size:14px;line-height:1.9;text-align:center;font-family:'Gowun Dodum',sans-serif}
`;

const gf = (f) => `https://fonts.googleapis.com/css2?${f}&display=swap`;
writeFileSync('prototypes/a-sky.html', page('시안 A · 맑은 하늘', gf('family=Gowun+Dodum'), A));
writeFileSync('prototypes/b-editorial.html', page('시안 B · 에디토리얼', gf('family=Gowun+Dodum&family=Noto+Serif+KR:wght@600;700'), B));
writeFileSync('prototypes/c-playground.html', page('시안 C · 놀이터', gf('family=Gowun+Dodum&family=Jua'), C));

writeFileSync('prototypes/index.html', `<!doctype html><meta charset="utf-8"><title>디자인 시안</title>
<style>body{font-family:sans-serif;max-width:640px;margin:60px auto;padding:0 20px;line-height:1.8}a{display:block;padding:16px 20px;margin:12px 0;border:1px solid #ccc;border-radius:10px;color:#111;text-decoration:none}a:hover{background:#f3f7ff}small{color:#666;display:block}</style>
<h1>사이잇다 디자인 시안</h1>
<a href="a-sky.html"><b>시안 A · 맑은 하늘</b><small>밝고 둥글고 친근한 느낌. 초등학생과 학부모 모두에게 부담 없는 방향</small></a>
<a href="b-editorial.html"><b>시안 B · 에디토리얼</b><small>단정한 남색·종이 톤. 교육부·교육청 보고용으로 가장 격식 있는 방향</small></a>
<a href="c-playground.html"><b>시안 C · 놀이터</b><small>굵은 테두리와 원색, 손글씨체. 아이들 눈높이에 가장 맞춘 방향</small></a>`);
