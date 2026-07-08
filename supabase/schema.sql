create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  avatar_url text,
  provider text not null default 'google',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_marks (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (
    type in (
      'bookmark',
      'note',
      'reflection',
      'review',
      'memorization',
      'important',
      'return-later'
    )
  ),
  page_number integer not null check (page_number between 1 and 604),
  page_range text,
  surah_name text,
  surah_number integer,
  juz_number integer,
  ayah_number integer,
  verse_key text check (verse_key is null or verse_key ~ '^[0-9]{1,3}:[0-9]{1,3}$'),
  title text check (title is null or length(title) <= 160),
  note text check (note is null or length(note) <= 5000),
  tags text[],
  color text check (color is null or length(color) <= 32),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_marks_user_page_idx
  on public.user_marks (user_id, page_number, updated_at desc);

create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  reader_theme text check (reader_theme is null or reader_theme in ('green', 'navy', 'beige', 'white', 'black')),
  mushaf_style text check (mushaf_style is null or mushaf_style in ('classic', 'premiumPaper')),
  reciter_id text,
  last_read_page integer check (last_read_page is null or last_read_page between 1 and 604),
  reading_mode text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.user_marks enable row level security;
alter table public.user_preferences enable row level security;

drop policy if exists "profiles are self readable" on public.profiles;
create policy "profiles are self readable"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles are self writable" on public.profiles;
create policy "profiles are self writable"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "profiles are self updatable" on public.profiles;
create policy "profiles are self updatable"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "marks are self readable" on public.user_marks;
create policy "marks are self readable"
  on public.user_marks for select
  using (auth.uid() = user_id);

drop policy if exists "marks are self insertable" on public.user_marks;
create policy "marks are self insertable"
  on public.user_marks for insert
  with check (auth.uid() = user_id);

drop policy if exists "marks are self updatable" on public.user_marks;
create policy "marks are self updatable"
  on public.user_marks for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "marks are self deletable" on public.user_marks;
create policy "marks are self deletable"
  on public.user_marks for delete
  using (auth.uid() = user_id);

drop policy if exists "preferences are self readable" on public.user_preferences;
create policy "preferences are self readable"
  on public.user_preferences for select
  using (auth.uid() = user_id);

drop policy if exists "preferences are self insertable" on public.user_preferences;
create policy "preferences are self insertable"
  on public.user_preferences for insert
  with check (auth.uid() = user_id);

drop policy if exists "preferences are self updatable" on public.user_preferences;
create policy "preferences are self updatable"
  on public.user_preferences for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
