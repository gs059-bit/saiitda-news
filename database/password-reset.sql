-- 아이디 가입 회원의 비밀번호 재설정 요청.
-- 학생이 로그인 화면에서 요청 → 최고 관리자가 기자실에서 임시 비밀번호 발급(Edge Function) → 학생이 임시 비밀번호로 로그인해 새 비밀번호를 정한다.
-- Supabase SQL Editor에서 한 번 실행한다. 여러 번 실행해도 안전하다. database/admin-tools.sql(saiitda_is_editor)을 먼저 실행해야 한다.

create table if not exists public.password_reset_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  username text not null,
  display_name text,
  status text not null default 'pending' check (status in ('pending', 'done', 'rejected')),
  created_at timestamptz not null default now(),
  handled_at timestamptz
);

-- 한 사람이 요청을 여러 번 눌러도 기다리는 요청은 하나만 남긴다
create unique index if not exists password_reset_one_pending
  on public.password_reset_requests (user_id) where status = 'pending';

alter table public.password_reset_requests enable row level security;

-- 최고 관리자만 보고(select), 거절·처리 표시(update)를 한다. 쓰기(insert)는 아래 함수로만 한다
drop policy if exists password_reset_select on public.password_reset_requests;
create policy password_reset_select on public.password_reset_requests
  for select to authenticated using (public.saiitda_is_editor());

drop policy if exists password_reset_update on public.password_reset_requests;
create policy password_reset_update on public.password_reset_requests
  for update to authenticated using (public.saiitda_is_editor()) with check (public.saiitda_is_editor());

-- 로그인 전(anon)에도 부를 수 있는 요청 함수.
-- 없는 아이디여도 똑같이 성공한 것처럼 끝나서, 어떤 아이디가 가입되어 있는지 알아낼 수 없다.
-- 관리자·선생님 계정은 이 경로로 요청할 수 없다(Supabase 대시보드에서 직접 처리)
create or replace function public.request_password_reset(p_username text)
returns void language plpgsql security definer set search_path = public as $$
declare
  p record;
begin
  select id, username, display_name into p
  from public.profiles
  where username = lower(trim(p_username))
    and coalesce(approval_status, 'approved') = 'approved'
    and coalesce(role, '') not in ('admin', 'teacher_admin');
  if not found then
    return;
  end if;
  insert into public.password_reset_requests (user_id, username, display_name)
  values (p.id, p.username, p.display_name)
  on conflict (user_id) where status = 'pending' do nothing;
end $$;

revoke execute on function public.request_password_reset(text) from public;
grant execute on function public.request_password_reset(text) to anon, authenticated;
