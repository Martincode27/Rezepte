-- "Was habe ich zuhause?" - Vorratsliste, gegen die Rezepte gematcht werden
-- (Matching passiert clientseitig ueber den Namen, wie schon bei der
-- Einkaufslisten-Zusammenfuehrung - kein amount noetig fuer V1, nur Vorhanden/Nicht).

create table pantry_items (
  id uuid primary key default gen_random_uuid(),
  name_raw text not null,
  ingredient_id uuid references ingredients(id),
  added_at timestamptz not null default now()
);

create index pantry_items_ingredient_id_idx on pantry_items (ingredient_id);

alter table pantry_items enable row level security;
create policy "allow all (private family app)" on pantry_items for all using (true) with check (true);
