-- Run in SQL Editor to add deletion without changing existing data.
begin;
create or replace function public.club_delete_album(selected_album bigint, selected_member bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare proposer bigint;
begin
 select member_id into proposer from public.club_albums where id=selected_album for update;
 if not found then raise exception 'Cet album a déjà été supprimé.'; end if;
 if selected_member is null or proposer<>selected_member then
  raise exception 'Tu peux seulement supprimer tes propres propositions.' using errcode='42501';
 end if;
 delete from public.club_ratings where album_id=selected_album;
 delete from public.club_albums where id=selected_album;
end;
$$;
revoke all on function public.club_delete_album(bigint,bigint) from public;
grant execute on function public.club_delete_album(bigint,bigint) to anon,authenticated;
commit;
