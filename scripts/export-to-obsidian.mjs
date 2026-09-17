// Exportiert jedes Rezept aus Supabase als einzelne Markdown-Datei nach Obsidian.
// Supabase bleibt die alleinige Wahrheitsquelle (Entscheidung 2026-09-17) - diese
// Dateien sind ein reiner, automatisch generierter Spiegel zum Lesen/Verlinken/
// Durchsuchen in Obsidian. Nicht direkt bearbeiten, Aenderungen gehen beim naechsten
// Lauf verloren. Loescht verwaiste Dateien (Rezept in Supabase geloescht/umbenannt).
// Aufruf: node scripts/export-to-obsidian.mjs

import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VAULT_DIR = 'D:\\Vault\\Projects\\Rezepte\\Rezepte';
const APP_URL = 'https://martincode27.github.io/Rezepte/';

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

async function sb(pathAndQuery) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase GET ${pathAndQuery} -> HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

function slugFilename(name) {
  return name.replace(/[\\/:*?"<>|]/g, '-').trim();
}

function findIng(ingredients, name) {
  const key = name.trim().toLowerCase();
  return ingredients.find((i) => i.name.trim().toLowerCase() === key);
}

function calcNutrition(recipe, ingredients) {
  let kcal = 0, protein = 0, carbs = 0, fat = 0, complete = true, any = false;
  for (const step of recipe.recipe_steps) {
    for (const item of step.recipe_items) {
      if (item.kind !== 'ingredient') continue;
      const db = findIng(ingredients, item.name_raw);
      const grams = parseFloat(String(item.amount || '').match(/^([\d.,]+)/)?.[0]?.replace(',', '.') || '');
      if (!db || !db.kcal || !grams) { complete = false; continue; }
      any = true;
      kcal += (db.kcal * grams) / 100;
      protein += (db.protein * grams) / 100;
      carbs += (db.carbs * grams) / 100;
      fat += (db.fat * grams) / 100;
    }
  }
  if (!any) return null;
  const portions = recipe.portions || 1;
  return {
    kcal: Math.round(kcal / portions),
    protein: Math.round((protein / portions) * 10) / 10,
    carbs: Math.round((carbs / portions) * 10) / 10,
    fat: Math.round((fat / portions) * 10) / 10,
    complete,
  };
}

function yamlList(arr) {
  if (!arr || !arr.length) return '[]';
  return '[' + arr.map((v) => JSON.stringify(v)).join(', ') + ']';
}

function itemLines(items) {
  return items
    .map((i) => `- ${i.name_raw}${i.amount ? ` — ${i.amount}` : ''}${i.hint ? ` (${i.hint})` : ''}`)
    .join('\n');
}

function buildMarkdown(r, ingredients) {
  const cats = r.categories || [];
  const steps = (r.recipe_steps || []).slice().sort((a, b) => a.step_order - b.step_order);
  const multi = steps.length > 1;
  const nutrition = calcNutrition(r, ingredients);
  const totalTime = (r.time_prep || 0) + (r.time_cook || 0) || null;

  let fm = '---\n';
  fm += `supabase_id: ${r.id}\n`;
  fm += `author: ${JSON.stringify(r.author || '')}\n`;
  fm += `schwierigkeit: ${JSON.stringify(r.difficulty || '')}\n`;
  fm += `zubereitungszeit_min: ${r.time_prep ?? 'null'}\n`;
  fm += `kochzeit_min: ${r.time_cook ?? 'null'}\n`;
  fm += `gesamtzeit_min: ${totalTime ?? 'null'}\n`;
  fm += `portionen: ${r.portions ?? 'null'}\n`;
  fm += `kategorien: ${yamlList(cats)}\n`;
  fm += `bild: ${JSON.stringify(r.image_url || '')}\n`;
  fm += `video: ${JSON.stringify(r.video_url || '')}\n`;
  fm += `zuletzt_synchronisiert: ${JSON.stringify(new Date().toISOString())}\n`;
  fm += '---\n\n';

  let body = `# ${r.name}\n\n`;
  body += `> [!info] Automatisch aus Supabase generiert — nicht hier bearbeiten, Änderungen gehen beim nächsten Export verloren. Bearbeiten über die App: ${APP_URL}\n\n`;
  if (r.image_url) body += `![${r.name}](${r.image_url})\n\n`;

  const metaBits = [];
  if (r.difficulty) metaBits.push(`Schwierigkeit: ${r.difficulty}`);
  if (totalTime) metaBits.push(`Zeit: ${totalTime} Min`);
  if (r.portions) metaBits.push(`Portionen: ${r.portions}`);
  if (r.author) metaBits.push(`Von: ${r.author}`);
  if (metaBits.length) body += metaBits.join(' · ') + '\n\n';
  if (cats.length) body += cats.map((c) => `#${c.replace(/\s+/g, '-')}`).join(' ') + '\n\n';

  if (nutrition) {
    body += `**Nährwerte pro Portion${nutrition.complete ? '' : ' (unvollständig)'}:** ${nutrition.kcal} kcal · ${nutrition.protein}g Protein · ${nutrition.carbs}g Kohlenhydrate · ${nutrition.fat}g Fett\n\n`;
  }

  steps.forEach((s, idx) => {
    const items = (s.recipe_items || []).slice().sort((a, b) => a.sort_order - b.sort_order);
    const ing = items.filter((i) => i.kind === 'ingredient');
    const sp = items.filter((i) => i.kind === 'spice');
    const pool = items.filter((i) => i.kind === 'pool');

    if (multi) body += `## Schritt ${idx + 1}${s.title ? `: ${s.title}` : ''}\n\n`;
    else if (s.title) body += `## ${s.title}\n\n`;

    if (ing.length) body += `**Zutaten**\n${itemLines(ing)}\n\n`;
    if (sp.length) body += `**Gewürze**\n${itemLines(sp)}\n\n`;
    if (pool.length) body += `**Optional**\n${itemLines(pool)}\n\n`;
    if (s.instructions) body += `${s.instructions}\n\n`;
  });

  if (r.video_url) body += `**Video:** ${r.video_url}\n`;

  return fm + body;
}

async function main() {
  mkdirSync(VAULT_DIR, { recursive: true });

  const [ingredients, recipes] = await Promise.all([
    sb('ingredients?select=id,name,kcal,protein,carbs,fat'),
    sb('recipes?select=*,recipe_steps(*,recipe_items(*))&recipe_steps.order=step_order.asc&recipe_steps.recipe_items.order=sort_order.asc&order=name.asc'),
  ]);
  console.log(`${recipes.length} Rezepte aus Supabase geladen`);

  const writtenFiles = new Set();
  for (const r of recipes) {
    const filename = slugFilename(r.name) + '.md';
    writeFileSync(path.join(VAULT_DIR, filename), buildMarkdown(r, ingredients), 'utf-8');
    writtenFiles.add(filename);
    console.log(`  ✓ ${filename}`);
  }

  // Verwaiste Dateien entfernen (Rezept geloescht/umbenannt seit letztem Export)
  const existing = readdirSync(VAULT_DIR).filter((f) => f.endsWith('.md'));
  for (const f of existing) {
    if (!writtenFiles.has(f)) {
      unlinkSync(path.join(VAULT_DIR, f));
      console.log(`  ✗ entfernt (verwaist): ${f}`);
    }
  }

  console.log('Fertig.');
}

main().catch((e) => { console.error(e); process.exit(1); });
