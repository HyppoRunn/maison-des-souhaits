-- =====================================================================
--  La Maison des Souhaits : base de données Supabase
--
--  À exécuter une seule fois dans Supabase : menu « SQL Editor »,
--  « New query », coller tout ce fichier, puis « Run ».
--
--  AVANT DE LANCER : remplacez CHANGE-MOI (tout en bas) par votre
--  code familial, par exemple sapin2026.
--
--  Sécurité : la table des souhaits n'est pas lisible directement.
--  Le site passe par les fonctions ci-dessous, qui vérifient toutes
--  le code familial. Le code est rangé dans un schéma « private »
--  que l'API publique de Supabase n'expose pas.
-- =====================================================================

create schema if not exists private;

create table if not exists private.settings (
  id          int primary key default 1 check (id = 1),
  family_code text not null check (char_length(family_code) >= 4)
);

create table if not exists public.wishes (
  slot       int primary key check (slot between 0 and 199),
  who        text not null check (char_length(btrim(who)) between 1 and 40),
  what       text not null check (char_length(btrim(what)) between 1 and 120),
  url        text check (url is null or (char_length(url) <= 2000 and url ~* '^https?://')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Aucun accès direct à la table depuis le navigateur : tout passe par les fonctions.
alter table public.wishes enable row level security;
revoke all on public.wishes from anon, authenticated;

-- ---------------------------------------------------------------------
-- Vérification du code familial
-- ---------------------------------------------------------------------
create or replace function private.require_code(p_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_code is null or not exists (
    select 1 from private.settings s where s.family_code = p_code
  ) then
    raise exception 'code_invalide' using errcode = '28000';
  end if;
end;
$$;

create or replace function private.clean_url(p_url text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare u text := nullif(btrim(coalesce(p_url, '')), '');
begin
  if u is null then return null; end if;
  if u !~* '^https?://' then u := 'https://' || u; end if;
  return u;
end;
$$;

-- ---------------------------------------------------------------------
-- Fonctions appelées par le site
-- ---------------------------------------------------------------------
create or replace function public.check_family_code(p_code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  return exists (select 1 from private.settings s where s.family_code = p_code);
end;
$$;

create or replace function public.list_wishes(p_code text)
returns table (slot int, who text, what text, url text, updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_code(p_code);
  return query
    select w.slot, w.who, w.what, w.url, w.updated_at
    from public.wishes w
    order by w.slot;
end;
$$;

create or replace function public.add_wish(p_code text, p_slot int, p_who text, p_what text, p_url text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_code(p_code);
  insert into public.wishes (slot, who, what, url)
  values (p_slot, btrim(p_who), btrim(p_what), private.clean_url(p_url));
exception
  when unique_violation then
    raise exception 'deja_pris' using errcode = 'P0001';
end;
$$;

create or replace function public.update_wish(p_code text, p_slot int, p_who text, p_what text, p_url text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_code(p_code);
  update public.wishes
     set who = btrim(p_who), what = btrim(p_what), url = private.clean_url(p_url), updated_at = now()
   where slot = p_slot;
  if not found then
    raise exception 'introuvable' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.delete_wish(p_code text, p_slot int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_code(p_code);
  delete from public.wishes where slot = p_slot;
end;
$$;

-- Seules ces cinq fonctions sont accessibles au site.
revoke all on function public.check_family_code(text) from public;
revoke all on function public.list_wishes(text) from public;
revoke all on function public.add_wish(text, int, text, text, text) from public;
revoke all on function public.update_wish(text, int, text, text, text) from public;
revoke all on function public.delete_wish(text, int) from public;
grant execute on function public.check_family_code(text) to anon, authenticated;
grant execute on function public.list_wishes(text) to anon, authenticated;
grant execute on function public.add_wish(text, int, text, text, text) to anon, authenticated;
grant execute on function public.update_wish(text, int, text, text, text) to anon, authenticated;
grant execute on function public.delete_wish(text, int) to anon, authenticated;

-- ---------------------------------------------------------------------
-- VOTRE CODE FAMILIAL : remplacez CHANGE-MOI ci-dessous.
-- Pour le changer plus tard, modifiez cette ligne et relancez-la seule.
-- ---------------------------------------------------------------------
insert into private.settings (id, family_code) values (1, 'CHANGE-MOI')
on conflict (id) do update set family_code = excluded.family_code;
