-- 기사 좋아요와 조회수. Supabase(xqp…) SQL Editor에서 한 번 실행한다. 여러 번 실행해도 안전하다.
-- 실행 전에 사이트를 배포해도 기사·댓글은 그대로 보이고, 좋아요 버튼과 조회수만 나오지 않는다.

-- 1) 좋아요: 한 사람이 한 기사에 하나. 누가 눌렀는지는 id로만 남고 이름은 보이지 않는다
create table if not exists public.article_likes (
  article_id uuid not null references public.articles (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (article_id, user_id)
);
alter table public.article_likes enable row level security;

-- 개수를 세려고 누구나 읽을 수 있다
drop policy if exists article_likes_select on public.article_likes;
create policy article_likes_select on public.article_likes for select using (true);

-- 승인된 회원이 발행된 기사에만, 자기 이름으로만 누른다
drop policy if exists article_likes_insert on public.article_likes;
create policy article_likes_insert on public.article_likes
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and coalesce(approval_status, 'approved') = 'approved'
    )
    and exists (select 1 from public.articles where articles.id = article_id and articles.status = 'published')
  );

drop policy if exists article_likes_delete on public.article_likes;
create policy article_likes_delete on public.article_likes
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- 2) 조회수: articles에 칸을 두면 조회할 때마다 updated_at 트리거가 돌아서 따로 둔다
create table if not exists public.article_stats (
  article_id uuid primary key references public.articles (id) on delete cascade,
  views integer not null default 0
);
alter table public.article_stats enable row level security;

drop policy if exists article_stats_select on public.article_stats;
create policy article_stats_select on public.article_stats for select using (true);
-- 쓰기 정책은 두지 않는다. 아래 함수로만 1씩 올린다

-- 발행된 기사만 센다. 같은 브라우저의 중복 조회는 사이트가 하루 한 번으로 거른다
create or replace function public.record_view(target uuid)
returns void language sql security definer set search_path = public as $$
  insert into public.article_stats (article_id, views)
  select id, 1 from public.articles where id = target and status = 'published'
  on conflict (article_id) do update set views = article_stats.views + 1;
$$;

revoke execute on function public.record_view(uuid) from public;
grant execute on function public.record_view(uuid) to anon, authenticated;
