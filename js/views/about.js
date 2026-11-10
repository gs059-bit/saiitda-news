
 // 사이잇다 고정 소개 페이지
// 기사와 별도로 운영하며 누구나 열람할 수 있다.

import { $ } from '../utils.js';

export function about(section = 'intro') {
  const page = section === 'reporters' ? 'reporters' : 'intro';

  // 기자단 포스터 및 표시 순서 (편집부 4명, 취재부 4명)
  const editors = [
    { name: '조은별', image: '/reporter-1.jpg' },
    { name: '이다연', image: '/reporter-2.jpg' },
    { name: '고다희', image: '/reporter-3.jpg' },
    { name: '김수빈', image: '/reporter-4.jpg' },
  ];
  const reportersTeam = [
    { name: '조승아', image: '/reporter-5.jpg' },
    { name: '조아라', image: '/reporter-6.jpg' },
    { name: '김유빈', image: '/reporter-7.jpg' },
    { name: '김은지', image: '/reporter-8.jpg' },
  ];

 const intro = `
  <p class="about-eyebrow">ABOUT SAIITDA</p>
  <h2>사이잇다란?</h2>

  <div style="
    width:100%;
    max-width:900px;
    margin:28px auto 0;
    padding:90px 15px 80px;
    background:transparent;
    font-family:'Pretendard','Malgun Gothic',sans-serif;
    color:#40372e;
  ">

    <div style="max-width:480px;margin:0 auto;">

      <p style="
        text-align:center;
        font-size:15px;
        font-weight:700;
        margin:0 0 5px;
        line-height:1.5;
      ">
        - 우리 사이의 이야기를 찾아, 세상과 잇다 -
      </p>

      <img
        src="/saiitda-about-logo.png"
        alt="사이잇다 로고"
        style="
          display:block;
          width:100%;
          max-width:420px;
          height:auto;
          margin:0 auto 50px;
        "
      >

      <div style="
        font-size:14px;
        line-height:1.75;
        text-align:left;
        font-weight:400;
      ">

        <p style="margin:0 0 22px;">
          ‘사이’는 학교 안의 다양한 관계와 공간을 뜻합니다.
          학생과 학생 사이, 학생과 선생님 사이,
          학교와 가정 사이, 학교와 마을 사이,
          그리고 오늘과 미래 사이를 의미합니다.
        </p>

        <p style="margin:0 0 22px;">
          ‘잇다’는 그 사이를 이야기와 기록으로 연결한다는
          뜻입니다. 학생기자들이 학교 곳곳을 살펴보고,
          사람을 만나고, 질문하고, 그 속에서 발견한
          이야기를 기사로 전하면서 서로를 이어 줍니다.
        </p>

        <p style="margin:0 0 4px;">
          따라서 「사이 잇다」에는
        </p>

        <p style="
          margin:0;
          font-size:15px;
          font-weight:700;
          line-height:1.7;
        ">
          우리 사이의 이야기를 발견하고,<br>
          사람과 사람을 잇고,<br>
          오늘의 강서초를 기록하여 미래로 잇는다.
        </p>

      </div>
    </div>
  </div>
`;

  const reporters = `
    <p class="about-eyebrow">OUR REPORTERS</p>
    <h2>어린이 기자단 소개</h2>
    <div class="about-line"></div>

    <p>사이잇다를 만들어 가는 어린이 기자들을 소개합니다.</p>
    <p>포스터를 클릭하면 크게 볼 수 있어요!</p>

    <h3 style="margin-top:36px;">✏️ 편집부</h3>
    <p>기사를 다듬고 신문을 완성하는 기자들</p>

    <div class="reporter-grid">
      ${editors.map(({ name, image }) => `
        <a class="reporter-card"
           href="${image}"
           target="_blank"
           rel="noopener noreferrer">
          <img src="${image}"
               alt="편집부 ${name} 어린이 기자 소개 포스터"
               loading="lazy">
          <strong>${name}</strong>
          <span>포스터 크게 보기</span>
        </a>
      `).join('')}
    </div>

    <h3 style="margin-top:52px;">📷 취재부</h3>
    <p>학교 곳곳의 이야기를 찾아 전하는 기자들</p>

    <div class="reporter-grid">
      ${reportersTeam.map(({ name, image }) => `
        <a class="reporter-card"
           href="${image}"
           target="_blank"
           rel="noopener noreferrer">
          <img src="${image}"
               alt="취재부 ${name} 어린이 기자 소개 포스터"
               loading="lazy">
          <strong>${name}</strong>
          <span>포스터 크게 보기</span>
        </a>
      `).join('')}
    </div>
  `;

$('#app').innerHTML = `
<style>
        .reporter-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 20px;
        margin-top: 28px;
      }

      .reporter-card {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 12px;
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 14px;
        text-decoration: none;
        color: #222;
        box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        transition: transform 0.2s;
      }

      .reporter-card:hover {
        transform: translateY(-4px);
      }

      .reporter-card img {
        display: block;
        width: 100%;
        height: auto;
        border-radius: 8px;
      }

      .reporter-card strong {
        text-align: center;
        font-size: 15px;
      }

      .reporter-card span {
        text-align: center;
        font-size: 12px;
        color: #777;
      }

      @media (max-width: 700px) {
        .reporter-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }
      }

      @media (max-width: 420px) {
        .reporter-grid {
          grid-template-columns: 1fr;
        }
      }
      .about-page {
        max-width: 1100px;
        margin: 0 auto;
        padding: 32px 12px 64px;
      }

      .about-heading {
        margin-bottom: 32px;
        padding-bottom: 20px;
        border-bottom: 2px solid #202020;
      }

      .about-heading h1 {
        font-size: clamp(24px, 4vw, 34px);
        margin: 0 0 8px;
      }

      .about-heading p {
        color: #737373;
        margin: 0;
      }

      .about-layout {
        display: grid;
        grid-template-columns: 240px minmax(0, 1fr);
        gap: 48px;
      }

      .about-menu {
        display: flex;
        flex-direction: column;
        gap: 6px;
        align-self: start;
      }

      .about-menu a {
        display: block;
        padding: 15px;
        color: inherit;
        text-decoration: none;
        border-bottom: 1px solid #ddd;
      }

      .about-menu a.active {
        font-weight: 700;
        background: #f2f2f2;
        border-left: 3px solid #222;
      }

      .about-content {
        min-width: 0;
        line-height: 1.9;
      }

      .about-content h2 {
        font-size: 29px;
        margin: 0 0 16px;
      }

      .about-content h3 {
        font-size: 20px;
        margin: 32px 0 18px;
      }

      .about-content p {
        margin-bottom: 20px;
      }

      .about-eyebrow {
        font-size: 12px;
        letter-spacing: 3px;
        color: #888;
      }

      .about-line {
        width: 44px;
        height: 3px;
        background: #222;
      }

      .about-quote {
        margin-top: 36px;
        padding: 30px;
        background: #f5f5f5;
        border-left: 3px solid #222;
        font-weight: 600;
      }

      @media (max-width: 700px) {
        .about-layout {
          grid-template-columns: 1fr;
          gap: 28px;
        }

        .about-menu {
          flex-direction: row;
          flex-wrap: wrap;
        }

        .about-menu a {
          flex: 1;
          font-size: 13px;
          text-align: center;
        }
      }
    </style>

    <section class="about-page">
      <header class="about-heading">
        <h1>사이를 잇는 사람들</h1>
        <p>사이잇다를 만들어 가는 우리의 이야기</p>
      </header>

      <div class="about-layout">
        <nav class="about-menu" aria-label="소개 목차">
          <a href="#/about/intro"
             class="${page === 'intro' ? 'active' : ''}"
             ${page === 'intro' ? 'aria-current="page"' : ''}>
            01. 사이잇다란?
          </a>

          <a href="#/about/reporters"
             class="${page === 'reporters' ? 'active' : ''}"
             ${page === 'reporters' ? 'aria-current="page"' : ''}>
            02. 어린이 기자단 소개
          </a>
        </nav>

        <article class="about-content">
          ${page === 'intro' ? intro : reporters}
        </article>
      </div>
    </section>
  `;
}
