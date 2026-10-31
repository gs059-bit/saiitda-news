-- 기자실 관리 기능: 수정 요청 사유, 카테고리 한 번에 저장, 회원 역할·차단 관리.
-- Supabase(xqp…) SQL Editor에서 한 번 실행한다. 여러 번 실행해도 안전하다.
-- 이 스크립트를 실행하기 전에 사이트를 배포해도 기사는 보이지만, 수정 요청 사유·카테고리 저장·회원 관리는 실행 뒤에 동작한다.

-- 최고 관리자(admin + is_super_admin + 승인됨)인지. 아래 함수들이 함께 쓴다
create or replace function public.saiitda_is_editor()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
      and is_super_admin = true
      and coalesce(approval_status, 'approved') = 'approved'
  );
$$;

-- 1) 수정 요청 사유: 관리자가 '수정 요청'할 때 적은 내용을 학생 기자가 기자실에서 본다
alter table public.articles add column if not exists review_note text;

-- 2) 카테고리 저장: 지우고 다시 넣기를 한 트랜잭션으로 묶어, 넣기가 실패해도 기존 목록이 남게 한다
create or replace function public.save_categories(names text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.saiitda_is_editor() then
    raise exception '최고 관리자만 카테고리를 바꿀 수 있습니다.';
  end if;
  if coalesce(array_length(names, 1), 0) = 0 then
    raise exception '카테고리를 하나 이상 입력해 주세요.';
  end if;
  delete from public.categories where true;
  insert into public.categories (name, sort_order)
  select n, i - 1 from unnest(names) with ordinality as t(n, i);
end $$;

-- 3) 회원 관리: 학생 기자 ↔ 일반 학생, 로그인 막기·다시 허용. 관리자·선생님 계정은 바꾸지 않는다
create or replace function public.set_member(target uuid, new_role text, new_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.saiitda_is_editor() then
    raise exception '최고 관리자만 회원 정보를 바꿀 수 있습니다.';
  end if;
  if new_role not in ('reporter', 'reader') or new_status not in ('approved', 'rejected') then
    raise exception '바꿀 수 없는 역할이나 상태입니다.';
  end if;
  update public.profiles
  set role = new_role, approval_status = new_status
  where id = target and coalesce(role, '') not in ('admin', 'teacher_admin');
  if not found then
    raise exception '관리자·선생님 계정은 여기서 바꿀 수 없습니다.';
  end if;
end $$;

revoke execute on function public.save_categories(text[]) from public, anon;
revoke execute on function public.set_member(uuid, text, text) from public, anon;
grant execute on function public.save_categories(text[]) to authenticated;
grant execute on function public.set_member(uuid, text, text) to authenticated;
