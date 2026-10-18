-- Dauer pro Zubereitungsschritt in Minuten (optional), wird in der Rezeptansicht am Schritt angezeigt.
alter table recipe_steps add column duration_min int;
