-- Ergaenzungen, die beim Sichten der echten Google-Sheets-Daten aufgefallen sind
-- (Felder, die im alten Formular nicht editierbar waren, aber in den Daten stecken)

alter table ingredients add column sugar numeric;
alter table ingredients add column fiber numeric;

alter table recipes add column video_url text;

alter table recipe_items add column optional boolean not null default false;
