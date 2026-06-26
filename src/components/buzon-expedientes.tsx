-- ============================================================
-- JusticiaFácil · Buzón · Asegura columnas de acuerdo_judicial
-- (Si ya existen, no pasa nada: usa "if not exists".)
-- Corre en la Supabase de JUSTICIA (dquoysougxqknvgooiqg).
-- ============================================================

create table if not exists public.acuerdo_judicial (
  id uuid primary key default gen_random_uuid(),
  expediente text,
  juzgado text,
  fecha_acuerdo date,
  tipo_acuerdo text,
  texto text,
  urgente boolean default false,
  leido boolean default false,
  origen text default 'manual',     -- manual | robot
  created_at timestamptz not null default now()
);

alter table public.acuerdo_judicial add column if not exists urgente boolean default false;
alter table public.acuerdo_judicial add column if not exists leido boolean default false;
alter table public.acuerdo_judicial add column if not exists origen text default 'manual';

alter table public.acuerdo_judicial enable row level security;
drop policy if exists p_acuerdo_rw on public.acuerdo_judicial;
create policy p_acuerdo_rw on public.acuerdo_judicial for all using (true) with check (true);

select count(*) as total, count(*) filter (where leido = false) as no_leidos from public.acuerdo_judicial;
