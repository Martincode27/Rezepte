// Einmaliges Migrationsskript: alte Google-Sheets/Apps-Script-Daten -> Supabase.
// Aufruf: node scripts/migrate-from-sheets.mjs
// Liest SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY aus .env, holt die Daten aus dem
// alten Apps-Script-Endpoint (siehe index.html) und schreibt sie normalisiert
// in die neuen Tabellen. Rezepte mit bereits vorhandenem Namen werden übersprungen,
// das Skript kann also gefahrlos mehrfach laufen.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

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
const OLD_API_URL = 'https://script.google.com/macros/s/AKfycbxfkwpokbDb88UDN-dsYek-vjqG6TAQ6VdlSIP0J6tTB3qwgQkG2RvCloIuexLg_zmLUQ/exec';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY fehlen in .env');
  process.exit(1);
}

async function sb(pathAndQuery, { method = 'GET', body, prefer } = {}) {
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
  };
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Supabase ${method} ${pathAndQuery} -> HTTP ${res.status}: ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

// alte API antwortete gelegentlich mit zwei aneinandergehaengten JSON-Objekten
function parseOldResponse(raw) {
  const t = raw.trim();
  const cut = t.indexOf('}{');
  return JSON.parse(cut > -1 ? t.slice(0, cut + 1) : t);
}

async function fetchOld(action) {
  const res = await fetch(`${OLD_API_URL}?action=${action}`);
  const raw = await res.text();
  return parseOldResponse(raw);
}

function normCat(c) {
  if (Array.isArray(c)) return c;
  if (typeof c === 'string') {
    const t = c.trim();
    if (t.startsWith('[')) {
      try { return JSON.parse(t); } catch { /* fall through */ }
    }
    return t ? [t] : [];
  }
  return [];
}

function num(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v) {
  return v === '' || v === undefined ? null : v;
}

async function main() {
  console.log('Lade alte Daten von Apps Script...');
  const [recipesRes, ingredientsRes] = await Promise.all([
    fetchOld('getAll'),
    fetchOld('getIngredients'),
  ]);
  const oldRecipes = recipesRes.recipes || [];
  const oldIngredients = ingredientsRes.ingredients || [];
  console.log(`  ${oldRecipes.length} Rezepte, ${oldIngredients.length} Zutaten gefunden`);

  // 1) Zutatendatenbank upserten (per Name, Unique-Constraint in der DB)
  // Das alte Sheet enthaelt vereinzelt exakte Namens-Duplikate (Dateneingabefehler) -
  // pro Name wird nur der letzte Eintrag behalten.
  console.log('Upserte Zutatendatenbank...');
  const dedupedIngredients = new Map();
  for (const i of oldIngredients) {
    if (dedupedIngredients.has(i.name)) {
      console.log(`  Duplikat in alten Daten übersprungen: ${i.name}`);
    }
    dedupedIngredients.set(i.name, i);
  }
  const ingredientRows = [...dedupedIngredients.values()].map((i) => ({
    name: i.name,
    category: str(i.category),
    kcal: num(i.kcal),
    protein: num(i.protein),
    carbs: num(i.carbs),
    fat: num(i.fat),
    sugar: num(i.sugar),
    fiber: num(i.fiber),
  }));
  await sb('ingredients?on_conflict=name', {
    method: 'POST',
    body: ingredientRows,
    prefer: 'resolution=merge-duplicates,return=minimal',
  });

  const allIngredients = await sb('ingredients?select=id,name');
  const ingredientIdByName = new Map(allIngredients.map((i) => [i.name.trim().toLowerCase(), i.id]));
  console.log(`  ${allIngredients.length} Zutaten in der DB`);

  // 2) bereits migrierte Rezepte ueberspringen (Name als Dedupe-Schluessel)
  const existingRecipes = await sb('recipes?select=id,name');
  const existingNames = new Set(existingRecipes.map((r) => r.name));

  let created = 0, skipped = 0, failed = 0;
  const unmatchedIngredientNames = new Set();

  for (const r of oldRecipes) {
    if (existingNames.has(r.name)) {
      console.log(`  ubersprungen (existiert schon): ${r.name}`);
      skipped++;
      continue;
    }
    try {
      const [recipeRow] = await sb('recipes', {
        method: 'POST',
        body: {
          name: r.name,
          author: str(r.author),
          categories: normCat(r.cat),
          difficulty: str(r.difficulty) || 'leicht',
          time_prep: num(r.timePrep),
          time_cook: num(r.timeCook),
          portions: num(r.portions),
          emoji: str(r.emoji),
          image_url: str(r.image),
          video_url: str(r.videoUrl),
          created_at: str(r.created) || undefined,
        },
        prefer: 'return=representation',
      });

      const steps = Array.isArray(r.steps) ? r.steps : [];
      for (let idx = 0; idx < steps.length; idx++) {
        const s = steps[idx];
        const [stepRow] = await sb('recipe_steps', {
          method: 'POST',
          body: {
            recipe_id: recipeRow.id,
            step_order: idx,
            title: str(s.title),
            instructions: str(s.steps),
          },
          prefer: 'return=representation',
        });

        const items = [];
        (s.ingredients || []).forEach((i, n) => {
          if (!i.name) return;
          const key = i.name.trim().toLowerCase();
          if (!ingredientIdByName.has(key)) unmatchedIngredientNames.add(i.name);
          items.push({
            step_id: stepRow.id,
            ingredient_id: ingredientIdByName.get(key) || null,
            name_raw: i.name,
            amount: str(i.amount),
            hint: str(i.hint),
            kind: 'ingredient',
            optional: !!i.optional,
            sort_order: n,
          });
        });
        (s.spices || []).forEach((sp, n) => {
          if (!sp.name) return;
          const key = sp.name.trim().toLowerCase();
          if (!ingredientIdByName.has(key)) unmatchedIngredientNames.add(sp.name);
          items.push({
            step_id: stepRow.id,
            ingredient_id: ingredientIdByName.get(key) || null,
            name_raw: sp.name,
            amount: str(sp.amount),
            hint: null,
            kind: 'spice',
            optional: false,
            sort_order: n,
          });
        });
        (s.pool || []).forEach((p, n) => {
          if (!p.name) return;
          const key = p.name.trim().toLowerCase();
          if (!ingredientIdByName.has(key)) unmatchedIngredientNames.add(p.name);
          items.push({
            step_id: stepRow.id,
            ingredient_id: ingredientIdByName.get(key) || null,
            name_raw: p.name,
            amount: str(p.amount),
            hint: null,
            kind: 'pool',
            optional: true,
            sort_order: n,
          });
        });

        if (items.length) {
          await sb('recipe_items', { method: 'POST', body: items, prefer: 'return=minimal' });
        }
      }

      console.log(`  importiert: ${r.name} (${steps.length} Schritte)`);
      created++;
    } catch (e) {
      console.error(`  FEHLER bei "${r.name}": ${e.message}`);
      failed++;
    }
  }

  console.log('\nFertig.');
  console.log(`  neu importiert: ${created}`);
  console.log(`  übersprungen (schon vorhanden): ${skipped}`);
  console.log(`  fehlgeschlagen: ${failed}`);
  if (unmatchedIngredientNames.size) {
    console.log(`  Zutaten-Namen ohne Treffer in der Zutatendatenbank (${unmatchedIngredientNames.size}, name_raw bleibt trotzdem erhalten):`);
    console.log('   - ' + [...unmatchedIngredientNames].sort().join('\n   - '));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
