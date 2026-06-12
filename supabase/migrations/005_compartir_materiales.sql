-- Permite compartir materiales (mapa + ruta) via enlace público.

alter table public.study_materials
  add column if not exists is_public boolean not null default false,
  add column if not exists share_id  uuid    not null default gen_random_uuid();

create unique index if not exists idx_study_materials_share_id
  on public.study_materials(share_id);

-- Permite lectura anónima de materiales públicos (no expone source_text;
-- la página solo selecciona las columnas seguras).
create policy "public read shared materials" on public.study_materials
  for select using (is_public = true);
