-- Persiste la conversación del tutor por (usuario, material).
-- Una fila por par; el array messages se sobreescribe en cada upsert.

create table public.material_chats (
  user_id    uuid not null references auth.users(id) on delete cascade,
  material_id uuid not null references public.study_materials(id) on delete cascade,
  messages   jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, material_id)
);

alter table public.material_chats enable row level security;

create policy "users own their chats" on public.material_chats
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());
