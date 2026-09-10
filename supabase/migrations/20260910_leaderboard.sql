-- Run in Supabase > SQL Editor to add the proposer leaderboard to the shared API.
begin;
create or replace function public.club_week(selected_week date) returns jsonb
language sql stable security invoker set search_path = '' as $$
 select jsonb_build_object(
 'members',(select coalesce(jsonb_agg(to_jsonb(m) order by m.id),'[]'::jsonb) from public.club_members m),
 'albums',(select coalesce(jsonb_agg(to_jsonb(a)||jsonb_build_object('ratings',
   (select coalesce(jsonb_agg(jsonb_build_object('member_id',r.member_id,'score',r.score) order by r.member_id),'[]'::jsonb)
    from public.club_ratings r where r.album_id=a.id)) order by a.member_id),'[]'::jsonb)
   from public.club_albums a where a.week=selected_week),
 'history',(select coalesce(jsonb_agg(to_jsonb(h) order by h.week desc),'[]'::jsonb) from (
   select a.week,count(distinct a.id) as album_count,count(r.score) as rating_count,round(avg(r.score),1) as average
   from public.club_albums a left join public.club_ratings r on r.album_id=a.id group by a.week
 ) h),
 'leaderboard',(select coalesce(jsonb_agg(to_jsonb(l) order by l.average is null,l.average desc,l.rating_count desc,l.album_count desc,l.name),'[]'::jsonb) from (
   select m.id as member_id,m.name,count(distinct a.id) as album_count,count(r.score) as rating_count,round(avg(r.score),1) as average
   from public.club_members m
   left join public.club_albums a on a.member_id=m.id
   left join public.club_ratings r on r.album_id=a.id
   group by m.id,m.name
 ) l));
$$;
revoke all on function public.club_week(date) from public;
grant execute on function public.club_week(date) to anon,authenticated;
commit;
