-- Storage-Bucket fuer Rezeptbilder (ersetzt den alten Base64-durchs-Apps-Script-Umweg)

insert into storage.buckets (id, name, public)
values ('recipe-images', 'recipe-images', true)
on conflict (id) do nothing;

-- offene Policies, analog zu den Tabellen: private Familien-App ohne eigenes Auth-System
create policy "public read recipe images"
on storage.objects for select
using (bucket_id = 'recipe-images');

create policy "anon upload recipe images"
on storage.objects for insert
with check (bucket_id = 'recipe-images');

create policy "anon update recipe images"
on storage.objects for update
using (bucket_id = 'recipe-images');

create policy "anon delete recipe images"
on storage.objects for delete
using (bucket_id = 'recipe-images');
