// 카테고리별 설명·사진 없는 기사의 배경색·아이콘. 카테고리 목록 자체는 DB(categories)가 정하고,
// 여기 없는 이름의 카테고리는 설명 없이 기본 색·아이콘으로 보인다
export const ALL = '전체기사';

export const CATEGORY_INFO = {
  '우리를 잇다': {
    desc: '어린이 기자들의 이야기',
    tint: '#fdebdc',
    icon: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M15 14.5c3 0 6 2 6 5.5"/>'
  },
  '오늘의 사이': {
    desc: '학교의 순간을 기록하다',
    tint: '#fff1c2',
    icon: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'
  },
  '세상을 잇다': {
    desc: '세상을 읽는 어린이의 시선',
    tint: '#dff1e6',
    icon: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.8 3 2.8 15 0 18M12 3c-2.8 3-2.8 15 0 18"/>'
  },
  '책 사이를 잇다': {
    desc: '책으로 만나는 새로운 생각',
    tint: '#ebe4f7',
    icon: '<path d="M12 6c-2-1.5-5-2-8-1.5V19c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V4.5C17 4 14 4.5 12 6zM12 6v14.5"/>'
  },
  '마음을 잇다': {
    desc: '교장 선생님과 나누는 이야기',
    tint: '#fbe2ea',
    icon: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>'
  }
};

// DB에 카테고리가 없을 때 쓰는 기본 목록
export const DEFAULT_CATEGORIES = Object.keys(CATEGORY_INFO);
