// Einmaliges Cleanup-Skript: verknuepft recipe_items.name_raw-Varianten mit
// bestehenden Zutaten (ohne den angezeigten Rezepttext zu aendern) und legt
// fehlende Zutaten mit geschaetzten Naehrwerten an. Loest die 19+ Faelle, bei
// denen die Naehrwertberechnung bisher keinen Treffer fand.
// Aufruf: node scripts/link-ingredients.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv(file) {
  const env = {};
  for (const line of readFileSync(file, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return env;
}

const env = loadEnv(path.join(__dirname, '..', '.env'));
const SUPABASE_URL = env.SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_PUBLISHABLE_KEY;

async function sb(pathAndQuery, { method = 'GET', body, prefer } = {}) {
  const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${method} ${pathAndQuery} -> HTTP ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

// Neue Zutaten mit geschaetzten Richtwerten (gleiche Genauigkeit wie bestehende Eintraege)
const NEW_INGREDIENTS = [
  { name: 'Milch', category: 'Milchprodukte', kcal: 65, protein: 3.3, carbs: 4.8, fat: 3.5 },
  { name: 'Wasser', category: 'Sonstiges', kcal: 0, protein: 0, carbs: 0, fat: 0 },
  { name: 'Rinderhack', category: 'Fleisch', kcal: 254, protein: 17.2, carbs: 0, fat: 20 },
  { name: 'Burgerbrötchen', category: 'Getreide', kcal: 280, protein: 9, carbs: 50, fat: 5 },
  { name: 'Burgerkäse', category: 'Milchprodukte', kcal: 330, protein: 17, carbs: 2, fat: 28 },
  { name: 'Bacon', category: 'Fleisch', kcal: 400, protein: 13, carbs: 1, fat: 38 },
  { name: 'Salatblätter', category: 'Gemüse', kcal: 15, protein: 1.3, carbs: 2, fat: 0.2 },
  { name: 'Burgersoße', category: 'Sonstiges', kcal: 380, protein: 1, carbs: 12, fat: 36 },
  { name: 'Rahmspinat (TK)', category: 'Gemüse', kcal: 75, protein: 3, carbs: 4, fat: 5 },
  { name: 'Pesto', category: 'Sonstiges', kcal: 450, protein: 4, carbs: 5, fat: 46 },
];

async function main() {
  console.log('Lege neue Zutaten an...');
  const created = await sb('ingredients?on_conflict=name', {
    method: 'POST',
    body: NEW_INGREDIENTS,
    prefer: 'resolution=merge-duplicates,return=representation',
  });
  const byName = new Map(created.map((i) => [i.name, i.id]));
  created.forEach((i) => console.log(`  ✓ ${i.name} (${i.id})`));

  // Bereits vorhandene Zutaten-IDs nachladen fuer die Verlinkungen
  const existing = await sb('ingredients?select=id,name');
  existing.forEach((i) => { if (!byName.has(i.name)) byName.set(i.name, i.id); });

  // name_raw (wie im Rezepttext steht) -> Ziel-Zutat (kanonischer Name in der DB)
  const LINKS = {
    'Knoblauchzehe': 'Knoblauch',
    'Joghurt oder Skyr': 'Skyr',
    'Aioli o.ä.': 'Aioli',
    'Tomaten': 'Tomate',
    'Hühnchen': 'Hähnchen',
    'Öl (zum Braten)': 'Olivenöl',
    'Orzo-Nudeln': 'Nudeln',
    'Kirschtomaten': 'Tomate',
    'Feta': 'Fetakäse',
    'Mineralwasser (mit Kohlensäure)': 'Wasser',
    // neu angelegte Zutaten direkt mit ihrem eigenen Namen verlinken
    'Milch': 'Milch',
    'Wasser': 'Wasser',
    'Rinderhack': 'Rinderhack',
    'Burgerbrötchen': 'Burgerbrötchen',
    'Burgerkäse': 'Burgerkäse',
    'Bacon': 'Bacon',
    'Salatblätter': 'Salatblätter',
    'Burgersoße': 'Burgersoße',
    'Rahmspinat (TK)': 'Rahmspinat (TK)',
    'Pesto': 'Pesto',
  };

  console.log('\nVerlinke recipe_items...');
  let total = 0;
  for (const [nameRaw, targetName] of Object.entries(LINKS)) {
    const targetId = byName.get(targetName);
    if (!targetId) { console.log(`  ✗ Ziel-Zutat "${targetName}" nicht gefunden, übersprungen`); continue; }
    const rows = await sb(`recipe_items?name_raw=eq.${encodeURIComponent(nameRaw)}&kind=eq.ingredient`, {
      method: 'PATCH',
      body: { ingredient_id: targetId },
      prefer: 'return=representation',
    });
    console.log(`  ✓ "${nameRaw}" -> ${targetName} (${rows.length} Zeile${rows.length!==1?'n':''})`);
    total += rows.length;
  }

  console.log('\nSynchronisiere Obsidian...');
  execFileSync(process.execPath, [path.join(__dirname, 'export-to-obsidian.mjs')], { stdio: 'inherit' });

  console.log(`\nFertig: ${created.length} neue Zutaten, ${total} recipe_items verlinkt.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
