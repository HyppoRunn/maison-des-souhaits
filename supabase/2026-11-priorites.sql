-- =====================================================================
--  Mise à jour : classement des souhaits par priorité
--
--  À lancer UNE fois : Supabase > SQL Editor > New query > coller ce
--  fichier > Run. Les souhaits et le code familial sont conservés.
-- =====================================================================

alter table public.wishes add column if not exists rank int check (rank is null or rank between 1 and 1000);

-- list_wishes renvoie maintenant aussi le rang : on remplace l'ancienne version.
drop function if exists public.list_wishes(text);

create or replace function public.list_wishes(p_code text)
returns table (slot int, who text, what text, url text, note text, rank int, updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_code(p_code);
  return query
    select w.slot, w.who, w.what, w.url, w.note, w.rank, w.updated_at
    from public.wishes w
    order by w.slot;
end;
$$;

-- Classement : reçoit les cadeaux d'une personne dans l'ordre voulu
-- (le plus voulu en premier) et leur donne les rangs 1, 2, 3…
create or replace function public.reorder_wishes(p_code text, p_slots int[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_code(p_code);
  if coalesce(array_length(p_slots, 1), 0) > 200 then
    raise exception 'trop_de_souhaits';
  end if;
  update public.wishes w
     set rank = t.idx
    from unnest(p_slots) with ordinality as t(s, idx)
   where w.slot = t.s;
end;
$$;

revoke all on function public.list_wishes(text) from public;
revoke all on function public.reorder_wishes(text, int[]) from public;
grant execute on function public.list_wishes(text) to anon, authenticated;
grant execute on function public.reorder_wishes(text, int[]) to anon, authenticated;

-- Recharger le cache de l'API Supabase
notify pgrst, 'reload schema';
