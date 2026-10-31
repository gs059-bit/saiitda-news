// 기사 조회수·좋아요 (database/likes-views.sql). 표가 아직 없으면 모두 0으로 본다
import { ready, db } from './supabase.js';

// 기사 id → { views, likes }. 학교 웹진 규모라 필터 없이 전부 받아 센다
export async function articleStats() {
  const stats = new Map();
  if (!ready) return stats;
  const get = id => stats.get(id) || stats.set(id, { views: 0, likes: 0 }).get(id);
  const [views, likes] = await Promise.all([
    db.from('article_stats').select('article_id,views').limit(5000),
    db.from('article_likes').select('article_id').limit(20000)
  ]);
  for (const r of views.data || []) get(r.article_id).views = r.views;
  for (const r of likes.data || []) get(r.article_id).likes++;
  return stats;
}

// 같은 브라우저에서는 기사마다 하루 한 번만 센다
export function recordView(id) {
  if (!ready) return;
  const key = `saiitda-view:${id}`;
  const today = new Date().toDateString();
  try {
    if (localStorage.getItem(key) === today) return;
    localStorage.setItem(key, today);
  } catch {
    // 저장소를 못 쓰면 거르지 않고 센다
  }
  db.rpc('record_view', { target: id }).then(({ error }) => {
    if (error) console.warn(error.message);
  });
}
