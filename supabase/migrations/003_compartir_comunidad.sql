-- ════════════════════════════════════════════════════════════════════════════
-- Migración 003 — Compartir exámenes y validación comunitaria
-- Ejecutar en: Supabase → SQL Editor → proyecto qndsdanfwqjfmwoifsfy
-- ════════════════════════════════════════════════════════════════════════════

-- Compartir exámenes: lectura pública opt-in mediante enlace con share_id
alter table public.saved_exams
  add column is_public boolean not null default false,
  add column share_id uuid not null default gen_random_uuid();

create unique index idx_saved_exams_share_id on public.saved_exams(share_id);

-- Cualquiera (incluso sin sesión) puede leer un examen marcado como público.
-- Se suma a la política "own exams" existente (las políticas se evalúan con OR).
create policy "public read shared exams" on public.saved_exams
  for select using (is_public = true);

-- Votos: "este examen me sirvió" (uno por usuario y examen)
create table public.exam_votes (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.saved_exams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (exam_id, user_id)
);

create index idx_exam_votes_exam_id on public.exam_votes(exam_id);

alter table public.exam_votes enable row level security;
create policy "insert own votes" on public.exam_votes
  for insert with check (auth.uid() = user_id);
create policy "delete own votes" on public.exam_votes
  for delete using (auth.uid() = user_id);
-- Los votos se ven si el examen es público o si es tuyo
create policy "read votes of shared or own exams" on public.exam_votes
  for select using (
    exists (
      select 1 from public.saved_exams e
      where e.id = exam_id and (e.is_public or e.user_id = auth.uid())
    )
  );

-- Reportes de error en preguntas concretas de exámenes compartidos
create table public.question_reports (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.saved_exams(id) on delete cascade,
  question_index int not null check (question_index >= 0),
  user_id uuid not null references auth.users(id) on delete cascade,
  motivo text not null check (char_length(motivo) between 5 and 500),
  created_at timestamptz not null default now()
);

create index idx_question_reports_exam_id on public.question_reports(exam_id);

alter table public.question_reports enable row level security;
create policy "insert own reports" on public.question_reports
  for insert with check (auth.uid() = user_id);
-- Los lee quien reportó y el autor del examen
create policy "read own or received reports" on public.question_reports
  for select using (
    auth.uid() = user_id
    or exists (
      select 1 from public.saved_exams e
      where e.id = exam_id and e.user_id = auth.uid()
    )
  );
