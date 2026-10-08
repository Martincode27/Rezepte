// Einmalig: alte "optional"-Markierungen an normalen Zutaten (kind=ingredient, optional=true,
// stammen aus den Google-Sheets-Daten) in den Pool verschieben (kind=pool). Hatte die Zutat eine
// Menge, bleibt sie Teil der Beispielvariante (in_example=true), damit sich die bisher
// berechneten Naehrwerte nicht aendern. Braucht Migration 0006 (Spalte in_example).
// Aufruf: node scripts/migrate-optional-to-pool.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = {};
for (const line of readFileSync(path.join(__dirname, '..', '.env'), 'utf-8').split('\n')) {
  const i = line.indexOf('=');
  if (i > 0 && !line.trim().startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}

async function sb(p, { method = 'GET', body } = {}) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${p}`, {
    method,
    headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${env.SUPABASE_PUBLISHABLE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

const items = await sb('recipe_items?select=id,name_raw,amount&kind=eq.ingredient&optional=eq.true');
console.log(`${items.length} optionale Zutaten gefunden`);
for (const it of items) {
  await sb(`recipe_items?id=eq.${it.id}`, { method: 'PATCH', body: { kind: 'pool', in_example: !!(it.amount && it.amount.trim()) } });
  console.log(`  ✓ ${it.name_raw}${it.amount ? ` (${it.amount}) -> Pool, Beispielvariante` : ' -> Pool'}`);
}
console.log('Fertig.');
