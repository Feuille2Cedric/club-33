begin;
set local role anon;
insert into public.club_members(name) values('Test participant');
insert into public.club_albums(member_id,week,title,artist)
select id,'2026-09-07','Test album','Test artist' from public.club_members where name='Test participant';
select public.club_rate(a.id,a.member_id,0) from public.club_albums a where title='Test album';
select public.club_rate(a.id,a.member_id,9) from public.club_albums a where title='Test album';
do $$ declare payload jsonb; begin
 payload:=public.club_week('2026-09-07');
 if jsonb_array_length(payload->'members')<>4 then raise exception 'Member addition failed'; end if;
 if (payload->'albums'->0->'ratings'->0->>'score')::int<>9 then raise exception 'Rating update failed'; end if;
 if (payload->'history'->0->>'average')::numeric<>9 then raise exception 'History average failed'; end if;
 begin
  delete from public.club_albums;
  raise exception 'Delete should be forbidden';
 exception when insufficient_privilege then null;
 end;
end $$;
rollback;
