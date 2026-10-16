-- LISTTA: esquema inicial para Supabase
-- Revise e aplique no SQL Editor do projeto Supabase correto.
-- RLS: usuários autenticados podem visualizar; somente usuários com app_metadata.role = 'admin'
-- podem inserir/alterar/excluir. Defina essa claim de forma confiável no servidor/Auth,
-- nunca a partir de metadados editáveis pelo próprio usuário.

create extension if not exists pgcrypto;

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index if not exists schools_name_active_unique
  on public.schools (upper(name)) where deleted = false;

create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  name text not null,
  note text not null default '',
  status text not null default 'nao_chegou'
    check (status in ('nao_chegou','atendido','faltou','foi_embora','espera')),
  date date not null default current_date,
  shift text not null check (shift in ('manha','tarde')),
  doctor text not null default '',
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists people_school_date_shift_idx
  on public.people (school_id, date, shift) where deleted = false;

alter table public.schools enable row level security;
alter table public.people enable row level security;

drop policy if exists "authenticated can read schools" on public.schools;
create policy "authenticated can read schools" on public.schools
  for select to authenticated using (true);
drop policy if exists "admins can insert schools" on public.schools;
create policy "admins can insert schools" on public.schools
  for insert to authenticated with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
drop policy if exists "admins can update schools" on public.schools;
create policy "admins can update schools" on public.schools
  for update to authenticated using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "authenticated can read people" on public.people;
create policy "authenticated can read people" on public.people
  for select to authenticated using (true);
drop policy if exists "admins can insert people" on public.people;
create policy "admins can insert people" on public.people
  for insert to authenticated with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
drop policy if exists "admins can update people" on public.people;
create policy "admins can update people" on public.people
  for update to authenticated using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Habilite schools e people em Database > Replication para receber eventos Realtime.
-- O aplicativo ainda precisa ser validado contra este esquema antes do uso institucional.
