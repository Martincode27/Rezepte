-- Optionale Zutaten (kind = 'pool') koennen Teil der "Beispielvariante" sein, mit der
-- die Naehrwerte eines Rezepts fest berechnet werden (z. B. Joghurt mit Banane+Heidelbeeren).
alter table recipe_items add column in_example boolean not null default false;
