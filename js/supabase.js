// Supabase 연결. HTML에서 config.js(window.SAIITDA_CONFIG)를 이 모듈보다 먼저 불러와야 한다
// 라이브러리 버전을 바꿀 때는 index.html·login.html의 modulepreload 주소도 함께 바꾼다
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8?bundle';

export const cfg = window.SAIITDA_CONFIG || {};
export const ready = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey);
export const db = ready ? createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;

export const school = cfg.schoolName || '우리 학교';
