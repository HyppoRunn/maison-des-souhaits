-- =====================================================================
--  Mise à jour : champ « Précisions » (taille, couleur, modèle…)
--
--  À lancer UNE fois sur une base déjà installée : Supabase > SQL Editor >
--  New query > coller ce fichier > Run. Les souhaits existants sont gardés,
--  le code familial ne change pas.
-- =====================================================================

alter table public.wishes
  add column if not exists note text check (note is null or char_length(note) <= 200);

-- Les fonctions changent de forme : on retire les anciennes versions.
drop function if exists public.list_wishes(text);
drop function if exists public.add_wish(text, int, text, text, text);
drop function if exists public.update_wish(text, int, text, text, text);

create or replace function public.list_wishes(p_code text)
returns table (slot int, who text, what text, url text, note text, updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_code(p_code);
  return query
    select w.slot, w.who, w.what, w.url, w.note, w.updated_at
    from public.wishes w
    order by w.slot;
end;
$$;

create or replace function public.add_wish(p_code text, p_slot int, p_who text, p_what text, p_url text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_code(p_code);
  insert into public.wishes (slot, who, what, url, note)
  values (p_slot, btrim(p_who), btrim(p_what), private.clean_url(p_url), nullif(btrim(coalesce(p_note, '')), ''));
exception
  when unique_violation then
    raise exception 'deja_pris' using errcode = 'P0001';
end;
$$;

create or replace function public.update_wish(p_code text, p_slot int, p_who text, p_what text, p_url text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_code(p_code);
  update public.wishes
     set who = btrim(p_who), what = btrim(p_what), url = private.clean_url(p_url),
         note = nullif(btrim(coalesce(p_note, '')), ''), updated_at = now()
   where slot = p_slot;
  if not found then
    raise exception 'introuvable' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.list_wishes(text) from public;
revoke all on function public.add_wish(text, int, text, text, text, text) from public;
revoke all on function public.update_wish(text, int, text, text, text, text) from public;
grant execute on function public.list_wishes(text) to anon, authenticated;
grant execute on function public.add_wish(text, int, text, text, text, text) to anon, authenticated;
grant execute on function public.update_wish(text, int, text, text, text, text) to anon, authenticated;

-- Recharger le cache de l'API Supabase
notify pgrst, 'reload schema';
