-- Mehrere Bilder pro Rezept. recipes.image_url bleibt das Titelbild (Karten-Ansicht,
-- Formular-Upload unveraendert). recipe_images sind zusaetzliche Galerie-Bilder,
-- in der Detail-Ansicht als Diashow gezeigt wenn mehr als eins vorhanden ist.

create table recipe_images (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  url text not null,
  sort_order int not null default 0
);

create index recipe_images_recipe_id_idx on recipe_images (recipe_id);

alter table recipe_images enable row level security;
create policy "allow all (private family app)" on recipe_images for all using (true) with check (true);
