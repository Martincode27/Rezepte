// Einmaliges Skript: alte Google-Drive-Bildlinks -> Supabase Storage.
// Grund: lh3.googleusercontent.com/d/... ist nicht fuer Hotlinking gedacht und
// faengt bei wiederholtem Laden an, mit HTTP 503 (Rate-Limit) zu antworten
// (am 2026-09-18 beim Testen der App aufgefallen). Laedt jedes Bild einmal
// herunter, laedt es in den recipe-images-Bucket hoch und aktualisiert
// recipes.image_url auf die neue Supabase-URL.
// Aufruf: node scripts/migrate-images-to-storage.mjs

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
const BUCKET = 'recipe-images';

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
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${method} ${pathAndQuery} -> HTTP ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function main() {
  const recipes = await sb('recipes?select=id,name,image_url&image_url=like.*googleusercontent*');
  console.log(`${recipes.length} Rezepte mit Google-Drive-Bild gefunden`);

  for (const r of recipes) {
    try {
      const imgRes = await fetch(r.image_url);
      if (!imgRes.ok) throw new Error(`Download fehlgeschlagen: HTTP ${imgRes.status}`);
      const buf = Buffer.from(await imgRes.arrayBuffer());
      const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
      const ext = contentType.includes('png') ? 'png' : 'jpg';
      const filename = `${r.id}.${ext}`;

      const upRes = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${filename}`, {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': contentType, 'x-upsert': 'true' },
        body: buf,
      });
      if (!upRes.ok) throw new Error(`Upload fehlgeschlagen: HTTP ${upRes.status} ${await upRes.text()}`);

      const newUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${filename}`;
      await sb(`recipes?id=eq.${r.id}`, { method: 'PATCH', body: { image_url: newUrl } });
      console.log(`  ✓ ${r.name} (${buf.length} bytes)`);
    } catch (e) {
      console.error(`  FEHLER bei "${r.name}": ${e.message}`);
    }
  }
  console.log('Fertig.');
}

main().catch((e) => { console.error(e); process.exit(1); });
