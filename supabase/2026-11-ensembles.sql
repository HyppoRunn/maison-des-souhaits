-- =====================================================================
--  Mise à jour : plusieurs liens par souhait (ensembles, lots)
--
--  À lancer UNE fois : Supabase > SQL Editor > New query > coller ce
--  fichier > Run. Les souhaits, précisions, classements et le code
--  familial sont conservés.
-- =====================================================================

alter table public.wishes add column if not exists more_urls text[] check (more_urls is null or array_length(more_urls, 1) <= 4);

-- Nettoie une liste de liens : retire les vides, ajoute https:// si besoin.
create or replace function private.clean_urls(p_urls text[])
returns text[]
language plpgsql
immutable
set search_path = ''
as $$
declare out text[];
begin
  select array_agg(c) into out
  from (select private.clean_url(u) as c from unnest(coalesce(p_urls, '{}'::text[])) as u) t
  where c is not null;
  if coalesce(array_length(out, 1), 0) > 4 then
    raise exception 'trop_de_liens';
  end if;
  if exists (select 1 from unnest(coalesce(out, '{}'::text[])) u where char_length(u) > 2000) then
    raise exception 'lien_trop_long';
  end if;
  return out;
end;
$$;

-- Les fonctions changent de forme : on retire les anciennes versions.
drop function if exists public.list_wishes(text);
drop function if exists public.add_wish(text, int, text, text, text);
drop function if exists public.add_wish(text, int, text, text, text, text);
drop function if exists public.update_wish(text, int, text, text, text);
drop function if exists public.update_wish(text, int, text, text, text, text);

create or replace function public.list_wishes(p_code text)
returns table (slot int, who text, what text, url text, more_urls text[], note text, rank int, updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_code(p_code);
  return query
    select w.slot, w.who, w.what, w.url, w.more_urls, w.note, w.rank, w.updated_at
    from public.wishes w
    order by w.slot;
end;
$$;

create or replace function public.add_wish(p_code text, p_slot int, p_who text, p_what text, p_url text, p_note text default null, p_more_urls text[] default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_code(p_code);
  insert into public.wishes (slot, who, what, url, more_urls, note)
  values (p_slot, btrim(p_who), btrim(p_what), private.clean_url(p_url), private.clean_urls(p_more_urls),
          nullif(btrim(coalesce(p_note, '')), ''));
exception
  when unique_violation then
    raise exception 'deja_pris' using errcode = 'P0001';
end;
$$;

create or replace function public.update_wish(p_code text, p_slot int, p_who text, p_what text, p_url text, p_note text default null, p_more_urls text[] default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_code(p_code);
  update public.wishes
     set who = btrim(p_who), what = btrim(p_what), url = private.clean_url(p_url),
         more_urls = private.clean_urls(p_more_urls),
         note = nullif(btrim(coalesce(p_note, '')), ''), updated_at = now()
   where slot = p_slot;
  if not found then
    raise exception 'introuvable' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.list_wishes(text) from public;
revoke all on function public.add_wish(text, int, text, text, text, text, text[]) from public;
revoke all on function public.update_wish(text, int, text, text, text, text, text[]) from public;
grant execute on function public.list_wishes(text) to anon, authenticated;
grant execute on function public.add_wish(text, int, text, text, text, text, text[]) to anon, authenticated;
grant execute on function public.update_wish(text, int, text, text, text, text, text[]) to anon, authenticated;

notify pgrst, 'reload schema';
