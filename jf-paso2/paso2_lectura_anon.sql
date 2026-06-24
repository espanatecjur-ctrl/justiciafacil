-- ============================================================
-- JusticiaFácil · Paso 2 · permitir que la APP lea los casos
-- Corre esto en Supabase -> SQL Editor -> Run.
--
-- Deja la tabla caso_juridico LEGIBLE para la app (sin login todavía).
-- Más adelante, al agregar el login, se cierra de nuevo.
-- ============================================================

drop policy if exists p_caso_lectura_app on public.caso_juridico;
create policy p_caso_lectura_app
  on public.caso_juridico
  for select
  using (true);
