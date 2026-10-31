# 사이잇다

강서초등학교 어린이 기자단 웹진. 빌드 과정 없는 정적 사이트이고, 데이터·로그인은 Supabase를 쓴다.

## 실행

```sh
python3 -m http.server 8000   # 또는 npm start → http://localhost:8000
```

ES 모듈을 쓰므로 `file://`로 열면 동작하지 않는다.

## 코드 검사·서식

처음 한 번 `npm install`로 개발 도구를 설치한다(사이트 배포에는 필요 없다).

```sh
npm run check    # ESLint 검사 + Prettier 서식 확인 (커밋 전에 실행)
npm run format   # Prettier로 서식 자동 정리
npm run lint     # ESLint만
```

## 배포 (Vercel)

- 저장소 파일을 빌드 없이 그대로 배포한다. `.vercelignore`에 적힌 개발용 파일(README, database/, package.json 등)은 배포하지 않는다.
- `vercel.json`이 보안 헤더(CSP 등)를 붙인다. CSP는 허용한 곳(이 사이트, esm.sh, Supabase)에서만 스크립트·사진·통신을 허용하므로,
  다른 곳의 사진이나 스크립트를 쓰려면 `vercel.json`의 해당 항목에 주소를 추가한다.

## 설정을 바꿀 때 함께 고칠 곳

| 바꾸는 것 | 고칠 곳 |
|---|---|
| 학교 이름·문의처·소개 문구 | `config.js` (화면의 학교 이름은 모두 여기서 채워진다). 단, `privacy.html` 본문과 `index.html`의 `og:` 공유 미리보기 태그는 직접 고친다 |
| 사이트 주소(도메인) | `index.html`의 `og:url`·`og:image`, Supabase 대시보드 Authentication → URL Configuration의 Site URL·Redirect URLs(`https://<주소>/login.html?reset=1`, 비밀번호 재설정에 필요) |
| 공유 미리보기 이미지 | `og-image.jpg` (1200×630). 바꾼 뒤 카카오 공유 디버거에서 캐시를 지운다 |
| Supabase 프로젝트 | `config.js`의 `supabaseUrl`·`supabaseAnonKey`, `index.html`·`login.html`의 `preconnect` 주소, `vercel.json` CSP의 Supabase 주소(3곳) |
| 날씨 위치 | `config.js`의 `weather` (위도·경도·이름). 지우면 날씨가 표시되지 않는다 |
| 날씨 자료 제공처 | `js/weather.js`, `vercel.json` CSP의 `connect-src`, `index.html` 바닥글 출처 |
| supabase-js 버전 | `js/supabase.js`의 import 주소, `index.html`·`login.html`의 `modulepreload` 주소 |

## 구조

```
config.js            Supabase 주소·공개 키, 학교 이름 등 (사이트마다 바꾸는 값)
index.html           웹진 본문 (주소 #/... 로 화면 전환)
login.html           로그인·회원가입 (#signup)
privacy.html         개인정보처리방침
css/
  base.css           모든 페이지 공통 색상 변수·기본 스타일
  main.css           index.html
  login.css          login.html
  privacy.css        privacy.html
js/
  supabase.js        Supabase 연결 (라이브러리 버전은 여기서 바꾼다)
  utils.js           $, esc(HTML 이스케이프), date 등
  roles.js           DB 역할 ↔ 화면 역할 변환, 역할 이름
  categories.js      카테고리별 설명·색·아이콘
  state.js           공유 상태, 권한 확인, DB에서 불러오기
  stats.js           기사 조회수·좋아요
  ui.js              카드·대표 기사 등 공용 HTML 조각
  app.js             index.html 진입점: 상단 메뉴와 라우터
  login.js           login.html 진입점
  views/
    home.js          메인 목록·검색          (#/)
    article.js       기사 읽기·댓글          (#/article/<id>)
    dashboard.js     기자실 기사 관리        (#/dashboard)
    editor.js        기사 작성·수정          (#/new, #/edit/<id>)
    me.js            내 정보·활동 내역       (#/me)
    admin.js         카테고리·디자인·가입 승인·회원 관리 (기자실 관리자 메뉴)
database/            Supabase SQL Editor에서 실행한 변경 스크립트
  admin-tools.sql    수정 요청 사유·카테고리 저장·회원 관리 (없으면 이 기능들이 동작하지 않는다)
  likes-views.sql    기사 좋아요·조회수 (없으면 좋아요 버튼과 조회수가 나오지 않는다)
```

새 화면을 추가할 때는 `js/views/`에 파일을 만들고 `js/app.js`의 `routes`에 주소를 등록한다.

## 역할

| 화면 역할 | DB `profiles.role` | 할 수 있는 일 |
|---|---|---|
| 관리자 | `admin` + `is_super_admin` | 기사 승인·발행·수정 요청, 카테고리·디자인, 댓글 삭제, 가입 승인, 회원 관리 |
| 선생님 | `teacher_admin` | 읽기·댓글만 (편집 권한 없음) |
| 학생 기자 | `reporter` | 기사 작성, 승인 요청 |
| 일반 학생 | `reader` (그 밖) | 읽기·댓글 |

실제 권한은 Supabase RLS 정책이 지킨다. 화면의 권한 확인은 버튼을 숨기는 용도일 뿐이다.
