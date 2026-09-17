-- Rezepte: Grundschema (Kern-Tabellen, deckt den heutigen Funktionsumfang ab)
-- Pantry/Wochenplan/Nutrition-Goals kommen erst mit den jeweiligen Features dazu.

create extension if not exists pgcrypto;

create table ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text,
  kcal numeric,
  protein numeric,
  carbs numeric,
  fat numeric,
  created_at timestamptz not null default now()
);

create table recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  author text,
  categories text[] not null default '{}',
  difficulty text check (difficulty in ('leicht', 'mittel', 'schwer')),
  time_prep int,
  time_cook int,
  portions int,
  emoji text,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table recipe_steps (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  step_order int not null,
  title text,
  instructions text
);

create table recipe_items (
  id uuid primary key default gen_random_uuid(),
  step_id uuid not null references recipe_steps(id) on delete cascade,
  ingredient_id uuid references ingredients(id),
  name_raw text not null,
  amount text,
  hint text,
  kind text not null check (kind in ('ingredient', 'spice', 'pool')),
  sort_order int not null default 0
);

create index recipe_items_step_id_idx on recipe_items (step_id);
create index recipe_items_ingredient_id_idx on recipe_items (ingredient_id);
create index recipe_steps_recipe_id_idx on recipe_steps (recipe_id);
create index recipes_categories_idx on recipes using gin (categories);

-- updated_at automatisch pflegen
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger recipes_set_updated_at
before update on recipes
for each row execute function set_updated_at();

-- RLS: private Familien-App ohne eigenes Auth-System, anon-Key liegt im Client-Code.
-- Offene Policy = funktional gleichwertig zum bisherigen offenen Apps-Script-Endpoint.
-- Bei Bedarf spaeter durch echtes Auth ersetzbar.
alter table ingredients enable row level security;
alter table recipes enable row level security;
alter table recipe_steps enable row level security;
alter table recipe_items enable row level security;

create policy "allow all (private family app)" on ingredients for all using (true) with check (true);
create policy "allow all (private family app)" on recipes for all using (true) with check (true);
create policy "allow all (private family app)" on recipe_steps for all using (true) with check (true);
create policy "allow all (private family app)" on recipe_items for all using (true) with check (true);
