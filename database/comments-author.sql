-- 댓글에 작성자 이름과 역할(관리자 / 선생님 / 학생 기자 / 일반 학생)을 함께 저장한다.
-- Supabase(xqp…) SQL Editor에서 한 번 실행한다. 여러 번 실행해도 안전하다.
--
-- 역할은 사용자가 보내는 값이 아니라 profiles.role에서 트리거가 채우므로 꾸며낼 수 없다.
-- DB 역할 이름을 화면용으로 바꿔 저장한다: admin→admin, teacher_admin→teacher, reporter→reporter, 그 외(reader 등)→student
-- profiles를 읽을 수 없는 방문자도 댓글의 역할 배지를 볼 수 있도록 댓글에 복사해 둔다.

alter table public.comments
  add column if not exists author_name text,
  add column if not exists author_role text;

create or replace function public.set_comment_author()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  p_role text;
  p_name text;
begin
  select role, display_name into p_role, p_name from public.profiles where id = new.author_id;
  new.author_role := case p_role when 'admin' then 'admin' when 'teacher_admin' then 'teacher' when 'reporter' then 'reporter' else 'student' end;
  new.author_name := coalesce(
    nullif(p_name, ''),
    (select raw_user_meta_data ->> 'display_name' from auth.users where id = new.author_id),
    '회원'
  );
  return new;
end $$;

drop trigger if exists comments_set_author on public.comments;
create trigger comments_set_author
  before insert on public.comments
  for each row execute function public.set_comment_author();

-- 이미 있는 댓글 채우기 (다시 실행하면 현재 역할로 고쳐진다)
update public.comments c
set author_role = case p.role when 'admin' then 'admin' when 'teacher_admin' then 'teacher' when 'reporter' then 'reporter' else 'student' end,
    author_name = coalesce(nullif(p.display_name, ''), '회원')
from public.profiles p
where p.id = c.author_id;

update public.comments
set author_role = 'student', author_name = coalesce(author_name, '회원')
where author_role is null;
