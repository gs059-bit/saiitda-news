// 화면 전체가 함께 쓰는 상태와, 그 상태를 DB에서 채우는 함수들
import { ready, db, school } from './supabase.js';
import { $ } from './utils.js';
import { viewRole } from './roles.js';
import { ALL, DEFAULT_CATEGORIES } from './categories.js';

const DEFAULT_SETTINGS = {
  accent: '#0067bd',
  font: 'classic',
  layout: 'grid',
  logo_width: 530,
  tagline: '우리 사이의 이야기를 찾아, 세상과 잇다',
  featured_id: null,
  issue: '',
  site_title: '사이잇다'
};

export const state = {
  loading: ready,
  session: null,
  profile: null,
  articles: [],
  categories: [...DEFAULT_CATEGORIES],
  siteSettings: { ...DEFAULT_SETTINGS },
  currentCat: ALL,
  search: ''
};

// 편집 권한(기사 승인·카테고리·디자인·댓글·회원 관리)은 최고 관리자만. 선생님은 일반 학생처럼 읽기와 댓글만 한다
export const isAdmin = () => Boolean(state.profile?.editor);
export const canModerate = isAdmin;
export const canWrite = () => isAdmin() || state.profile?.role === 'reporter';
export const isMine = a => a.author_id === state.session?.user?.id;

export const published = () => state.articles.filter(a => a.status === 'published');

// profile.role은 화면용 역할로 바꿔 둔다. 승인 전이면 일반 학생
export async function loadProfile() {
  state.profile = null;
  if (!state.session) return;
  const { data, error } = await db
    .from('profiles')
    .select('id,display_name,role,approval_status,is_super_admin')
    .eq('id', state.session.user.id)
    .maybeSingle();
  if (error) throw error;
  if (data) {
    const ok = !data.approval_status || data.approval_status === 'approved';
    data.editor = ok && data.role === 'admin' && data.is_super_admin === true;
    data.role = ok ? viewRole(data.role) : 'student';
  }
  state.profile = data;
}

export async function loadCategories() {
  if (!ready) return;
  const { data, error } = await db.from('categories').select('name').order('sort_order');
  if (!error && data?.length) state.categories = data.map(x => x.name);
}

export async function loadSettings() {
  if (ready) {
    const { data, error } = await db.from('site_settings').select('key,value').eq('key', 'main').maybeSingle();
    if (!error && data?.value) state.siteSettings = { ...state.siteSettings, ...data.value };
  }
  applySettings();
}

export function applySettings() {
  const x = state.siteSettings;
  const root = document.documentElement.style;
  root.setProperty('--blue', /^#[0-9a-fA-F]{6}$/.test(x.accent) ? x.accent : DEFAULT_SETTINGS.accent);
  root.setProperty('--logo-width', `${Math.min(700, Math.max(220, Number(x.logo_width) || 530))}px`);
  document.body.dataset.font = ['classic', 'modern'].includes(x.font) ? x.font : 'classic';
  document.body.dataset.layout = ['grid', 'list'].includes(x.layout) ? x.layout : 'grid';
  $('#tagline').textContent = x.tagline || '';
  document.title = `${x.site_title || '사이잇다'} | ${school} 어린이 기자단 웹진`;
}

// review_note 칸이 아직 없으면(database/admin-tools.sql 실행 전) 그 칸만 빼고 다시 불러온다
export async function loadArticles() {
  if (!ready) return;
  const query = cols =>
    db
      .from('articles')
      .select(cols)
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(300);
  const cols =
    'id,title,summary,body,category,cover_url,author_name,author_id,status,created_at,published_at,updated_at';
  let { data, error } = await query(cols + ',review_note');
  if (error) ({ data, error } = await query(cols));
  if (error) {
    console.error(error);
    return;
  }
  state.articles = data || [];
}
