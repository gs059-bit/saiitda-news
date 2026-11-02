
 // 사이잇다 고정 소개 페이지
// 기사와 별도로 운영하며 누구나 열람할 수 있다.

import { $ } from '../utils.js';

export function about(section = 'intro') {
  const page = section === 'reporters' ? 'reporters' : 'intro';
  const intro = `
    <p class="about-eyebrow">ABOUT SAIITDA</p>
    <h2>사이잇다란?</h2>

    <div style="margin-top:28px; text-align:center;">
      <img
        src="/saiitda-intro.png"
        alt="사이잇다 소개 자료 전체"
        style="
          display:block;
          width:100%;
          max-width:900px;
          height:auto;
          margin:0 auto;
        "
      >
    </div>

    <p style="margin-top:20px; text-align:center;">
      <a href="/saiitda-intro.pdf"
         target="_blank"
         rel="noopener noreferrer">
        소개 자료 원본 PDF 보기
      </a>
    </p>
  `;
  const reporters = `
    <p class="about-eyebrow">OUR REPORTERS</p>
    <h2>어린이 기자단 소개</h2>
    <div class="about-line"></div>

    <h3>사이잇다를 만드는 사람들</h3>

    <p>
      강서초등학교 어린이 기자단을 소개합니다!
    </p>

    <p>
      우리 학교의 소식을 전하고,
      세상을 새로운 시선으로 바라보는
      어린이 기자들의 이야기를 만나보세요.
    </p>

    <div class="about-quote">
      이곳에 어린이 기자들의 사진과
      자기소개 카드가 들어갈 예정입니다.
    </div>
  `;

$('#app').innerHTML = `
<style>
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
