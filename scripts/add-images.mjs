// Ergaenzt Fotos zu einem bereits bestehenden Rezept (per Namen gefunden).
// Erstes Bild wird nur dann Titelbild, wenn das Rezept noch keins hat -
// sonst gehen alle mitgegebenen Bilder in die Galerie (recipe_images).
// Aufruf: node scripts/add-images.mjs "Rezeptname" pfad1.jpg pfad2.jpg ...
// Fuehrt am Ende automatisch den Obsidian-Export aus.

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
const BUCKET = 'recipe-images';

async function sb(pathAndQuery, { method = 'GET', body, prefer } = {}) {
  const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${method} ${pathAndQuery} -> HTTP ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
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
  const [name, ...imagePaths] = process.argv.slice(2);
  if (!name || !imagePaths.length) {
    console.error('Aufruf: node scripts/add-images.mjs "Rezeptname" pfad1.jpg pfad2.jpg ...');
    process.exit(1);
  }

  const [recipe] = await sb(`recipes?name=eq.${encodeURIComponent(name)}&select=id,name,image_url`);
  if (!recipe) throw new Error(`Kein Rezept mit dem Namen "${name}" gefunden`);

  const existing = await sb(`recipe_images?recipe_id=eq.${recipe.id}&select=sort_order&order=sort_order.desc&limit=1`);
  let nextOrder = existing.length ? existing[0].sort_order + 1 : 1;

  for (const p of imagePaths) {
    const buf = readFileSync(p);
    const contentType = p.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
    if (!recipe.image_url) {
      const url = await uploadImage(recipe.id, '', buf, contentType);
      await sb(`recipes?id=eq.${recipe.id}`, { method: 'PATCH', body: { image_url: url } });
      recipe.image_url = url;
      console.log(`  Titelbild gesetzt: ${url}`);
    } else {
      const url = await uploadImage(recipe.id, `-${nextOrder}`, buf, contentType);
      await sb('recipe_images', { method: 'POST', body: { recipe_id: recipe.id, url, sort_order: nextOrder }, prefer: 'return=minimal' });
      console.log(`  Galerie-Bild ergaenzt: ${url}`);
      nextOrder++;
    }
  }

  console.log('Synchronisiere Obsidian...');
  execFileSync(process.execPath, [path.join(__dirname, 'export-to-obsidian.mjs')], { stdio: 'inherit' });
  console.log(`\nFertig: ${imagePaths.length} Bild(er) zu "${recipe.name}" ergaenzt.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
