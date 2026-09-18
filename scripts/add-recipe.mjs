// Fuegt ein Rezept direkt in Supabase ein, aus einer JSON-Datei (siehe unten fuer die Form).
// Fuer den vereinfachten Import: Claude erstellt die JSON-Datei aus einer Audio-/Text-
// Beschreibung + Foto, die der Nutzer im Chat schickt, und ruft dieses Skript auf.
// Aufruf: node scripts/add-recipe.mjs pfad/zum/rezept.json
//
// JSON-Form:
// {
//   "name": "...", "author": "...", "categories": ["mittagessen", ...],
//   "difficulty": "leicht|mittel|schwer", "timePrep": 20, "timeCook": 10,
//   "portions": 4, "emoji": "🍝", "videoUrl": null,
//   "images": [{"path": "C:\\...\\foto.jpg"}, {"url": "https://..."}],
//     // erstes Bild = Titelbild, weitere = Galerie (Diashow in der Detail-Ansicht).
//     // Kompatibel: "imagePath"/"imageUrl" (ein einzelnes Bild) gehen weiterhin auch.
//   "steps": [
//     { "title": "", "instructions": "...",
//       "ingredients": [{"name": "...", "amount": "...", "hint": ""}],
//       "spices": [{"name": "...", "amount": ""}],
//       "pool": [{"name": "...", "amount": ""}] }
//   ]
// }
//
// Fuehrt am Ende automatisch den Obsidian-Export aus, damit die neue Notiz sofort da ist.

import { readFileSync, existsSync } from 'node:fs';
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
const BUCKET = 'recipe-images';

async function sb(pathAndQuery, { method = 'GET', body, prefer } = {}) {
  const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${method} ${pathAndQuery} -> HTTP ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function resolveImage(spec) {
  // spec: {path: "..."} lokale Datei, oder {url: "..."} Download
  if (spec.path) {
    return { buf: readFileSync(spec.path), contentType: spec.path.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg' };
  }
  const res = await fetch(spec.url);
  if (!res.ok) throw new Error(`Bild-Download fehlgeschlagen: HTTP ${res.status}`);
  return { buf: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get('content-type') || 'image/jpeg' };
}

async function uploadImage(recipeId, suffix, buf, contentType) {
  const ext = contentType.includes('png') ? 'png' : 'jpg';
  const filename = `${recipeId}${suffix}.${ext}`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${filename}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': contentType, 'x-upsert': 'true' },
    body: buf,
  });
  if (!res.ok) throw new Error(`Bild-Upload fehlgeschlagen: HTTP ${res.status} ${await res.text()}`);
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${filename}`;
}

async function main() {
  const jsonPath = process.argv[2];
  if (!jsonPath || !existsSync(jsonPath)) {
    console.error('Aufruf: node scripts/add-recipe.mjs pfad/zum/rezept.json');
    process.exit(1);
  }
  const data = JSON.parse(readFileSync(jsonPath, 'utf-8'));
  if (!data.name || !Array.isArray(data.steps) || !data.steps.length) {
    throw new Error('JSON braucht mindestens "name" und ein nicht-leeres "steps"-Array');
  }

  const recipeBody = {
    name: data.name,
    author: data.author || null,
    categories: data.categories || [],
    difficulty: data.difficulty || 'leicht',
    time_prep: data.timePrep ?? null,
    time_cook: data.timeCook ?? null,
    portions: data.portions ?? null,
    emoji: data.emoji || '🍽️',
    video_url: data.videoUrl || null,
  };
  const [recipeRow] = await sb('recipes', { method: 'POST', body: recipeBody, prefer: 'return=representation' });
  console.log(`Rezept angelegt: ${data.name} (${recipeRow.id})`);

  // Bilder: erstes wird Titelbild, weitere gehen in recipe_images (Galerie).
  // "images": [{"path":"..."}, {"url":"..."}] ODER Kompatibilitaet mit imagePath/imageUrl (ein Bild)
  const images = data.images || (data.imagePath ? [{ path: data.imagePath }] : data.imageUrl ? [{ url: data.imageUrl }] : []);
  if (images.length) {
    const { buf, contentType } = await resolveImage(images[0]);
    const coverUrl = await uploadImage(recipeRow.id, '', buf, contentType);
    await sb(`recipes?id=eq.${recipeRow.id}`, { method: 'PATCH', body: { image_url: coverUrl } });
    console.log(`  Titelbild hochgeladen: ${coverUrl}`);

    if (images.length > 1) {
      const galleryRows = [];
      for (let i = 1; i < images.length; i++) {
        const { buf, contentType } = await resolveImage(images[i]);
        const url = await uploadImage(recipeRow.id, `-${i}`, buf, contentType);
        galleryRows.push({ recipe_id: recipeRow.id, url, sort_order: i });
        console.log(`  Galerie-Bild ${i} hochgeladen: ${url}`);
      }
      await sb('recipe_images', { method: 'POST', body: galleryRows, prefer: 'return=minimal' });
    }
  }

  // Schritte + Zutaten/Gewuerze/Pool
  for (let idx = 0; idx < data.steps.length; idx++) {
    const s = data.steps[idx];
    const [stepRow] = await sb('recipe_steps', {
      method: 'POST',
      body: { recipe_id: recipeRow.id, step_order: idx, title: s.title || null, instructions: s.instructions || null },
      prefer: 'return=representation',
    });
    const items = [];
    (s.ingredients || []).forEach((i, n) => items.push({ step_id: stepRow.id, name_raw: i.name, amount: i.amount || null, hint: i.hint || null, kind: 'ingredient', optional: false, sort_order: n }));
    (s.spices || []).forEach((sp, n) => items.push({ step_id: stepRow.id, name_raw: sp.name, amount: sp.amount || null, hint: null, kind: 'spice', optional: false, sort_order: n }));
    (s.pool || []).forEach((p, n) => items.push({ step_id: stepRow.id, name_raw: p.name, amount: p.amount || null, hint: null, kind: 'pool', optional: true, sort_order: n }));
    if (items.length) await sb('recipe_items', { method: 'POST', body: items, prefer: 'return=minimal' });
    console.log(`  Schritt ${idx + 1} gespeichert (${items.length} Zeilen)`);
  }

  console.log('Synchronisiere Obsidian...');
  execFileSync(process.execPath, [path.join(__dirname, 'export-to-obsidian.mjs')], { stdio: 'inherit' });

  console.log(`\nFertig: ${data.name} (${recipeRow.id})`);
}

main().catch((e) => { console.error(e); process.exit(1); });
