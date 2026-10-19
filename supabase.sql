-- Poésie et Rimes : table des poèmes partagés.
-- À coller dans Supabase → SQL Editor → New query → Run.

create table if not exists public.poemes (
  id uuid primary key default gen_random_uuid(),
  titre text not null check (char_length(titre) between 1 and 200),
  auteur text not null default '' check (char_length(auteur) <= 200),
  langue text not null check (langue in ('fr', 'ar')),
  vers text[] not null check (array_length(vers, 1) between 1 and 300),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null
);

alter table public.poemes enable row level security;

-- Tout le monde (élèves compris, sans compte) peut lire les poèmes.
drop policy if exists "Lecture pour tous" on public.poemes;
create policy "Lecture pour tous" on public.poemes
  for select to anon, authenticated using (true);

-- Seuls les enseignants connectés peuvent ajouter et supprimer.
drop policy if exists "Ajout par les enseignants" on public.poemes;
create policy "Ajout par les enseignants" on public.poemes
  for insert to authenticated with check (true);

drop policy if exists "Suppression par les enseignants" on public.poemes;
create policy "Suppression par les enseignants" on public.poemes
  for delete to authenticated using (true);
