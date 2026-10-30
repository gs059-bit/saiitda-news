-- 댓글을 승인 없이 바로 공개하고, 최고 관리자만 댓글을 삭제할 수 있게 한다.
-- Supabase(xqp…) SQL Editor에서 한 번 실행한다. 여러 번 실행해도 안전하다.
-- (drop policy가 들어 있어 "destructive operations" 경고가 뜨지만, 정책을 바꿔 끼우는 것이고 댓글은 지우지 않는다)

-- 1) 작성 규칙: 'pending' 대신 'approved'로 바로 저장한다. 나머지 조건(본인, 승인된 회원, 발행된 기사)은 그대로
drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and status = 'approved'
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid())
        and approval_status = 'approved'
        and role in ('reader', 'reporter', 'admin', 'teacher_admin')
    )
    and exists (
      select 1 from public.articles
      where articles.id = comments.article_id and articles.status = 'published'
    )
  );

-- 2) 삭제 규칙: 최고 관리자(admin + is_super_admin + 승인됨)만
drop policy if exists comments_admin_delete on public.comments;
create policy comments_admin_delete on public.comments
  for delete to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid())
        and role = 'admin'
        and is_super_admin = true
        and approval_status = 'approved'
    )
  );

-- 3) 승인을 기다리던 기존 댓글은 공개로 바꾼다
update public.comments set status = 'approved' where status = 'pending';
