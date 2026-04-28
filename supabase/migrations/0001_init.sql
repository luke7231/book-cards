-- projects 테이블
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  book_title text not null,
  style text not null default 'engraving',
  brand_name text,
  status text not null default 'draft'
    check (status in ('draft', 'text_approved', 'images_generated', 'completed')),
  hook_text text,
  caption text,
  hashtags text,
  created_at timestamptz not null default now()
);

-- cards 테이블
create table if not exists cards (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  card_number integer not null,  -- 0=커버, 1-13=본문, 14=마무리
  title text not null,
  body text not null,
  image_prompt text not null,
  confidence text not null default '중' check (confidence in ('상', '중', '하')),
  image_url text,
  composed_url text,
  created_at timestamptz not null default now(),
  unique (project_id, card_number)
);

-- Storage 버킷: card-images
insert into storage.buckets (id, name, public)
  values ('card-images', 'card-images', true)
  on conflict (id) do nothing;

-- Storage 정책: 누구나 읽기 가능
drop policy if exists "card-images public read" on storage.objects;
create policy "card-images public read"
  on storage.objects for select
  using (bucket_id = 'card-images');

-- Storage 정책: service role만 삽입/수정
drop policy if exists "card-images service write" on storage.objects;
create policy "card-images service write"
  on storage.objects for insert
  with check (bucket_id = 'card-images');
