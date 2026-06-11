-- ════════════════════════════════════════════════════════════════════════════
-- Migración 002 — Materiales de estudio, flashcards y repasos
-- Ejecutar en: Supabase → SQL Editor → proyecto qndsdanfwqjfmwoifsfy
-- ════════════════════════════════════════════════════════════════════════════

-- Materiales de estudio: el material fuente + análisis conceptual generado por IA
create table public.study_materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  folder_id uuid references public.folders(id) on delete set null,
  title text not null,
  source_text text not null,
  char_count int not null,
  analysis jsonb,
  analysis_status text not null default 'pending' check (analysis_status in ('pending','processing','ready','error')),
  created_at timestamptz not null default now()
);

create index idx_study_materials_user_id on public.study_materials(user_id);

alter table public.study_materials enable row level security;
create policy "own materials" on public.study_materials
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Flashcards generadas a partir de un material
create table public.flashcards (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.study_materials(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  tema text not null,
  front text not null,
  back text not null,
  created_at timestamptz not null default now()
);

create index idx_flashcards_material_id on public.flashcards(material_id);
create index idx_flashcards_user_id on public.flashcards(user_id);

alter table public.flashcards enable row level security;
create policy "own flashcards" on public.flashcards
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Historial de repasos (active recall) — base de la memoria académica
create table public.flashcard_reviews (
  id uuid primary key default gen_random_uuid(),
  flashcard_id uuid not null references public.flashcards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating int not null check (rating between 1 and 3), -- 1 otra vez · 2 difícil · 3 bien
  reviewed_at timestamptz not null default now()
);

create index idx_flashcard_reviews_flashcard_id on public.flashcard_reviews(flashcard_id);
create index idx_flashcard_reviews_user_id on public.flashcard_reviews(user_id);

alter table public.flashcard_reviews enable row level security;
create policy "own reviews" on public.flashcard_reviews
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Vincular exámenes a materiales (opcional, para memoria académica)
alter table public.saved_exams
  add column material_id uuid references public.study_materials(id) on delete set null;

create index idx_saved_exams_material_id on public.saved_exams(material_id);
