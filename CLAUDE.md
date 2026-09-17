# CLAUDE.md — Projekt "Rezepte"

> Diese Datei wird von Claude Code zu Beginn **jeder** Session automatisch gelesen.
> Sie ist das verbindliche Regelwerk und der zentrale Wissensspeicher für dieses Projekt.
> Claude: Aktualisiere Abschnitt 6 (Changelog) am Ende jeder Session.

Wissensspeicher/Notizen (Backlog, Entscheidungen, Journal) liegen **nicht** hier, sondern im
projektübergreifenden Obsidian-Vault unter **`D:\Vault\Projects\Rezepte\`** (eigenes Git-Repo,
getrennt von diesem Code-Repo) — analog zum TradingBot-Projekt.

Zuletzt aktualisiert: 2026-09-18

**Live:** https://martincode27.github.io/Rezepte/ (GitHub Pages, Repo `Martincode27/Rezepte`, öffentlich)

---

## 0. Projektziel

Eine private Rezepte-App (Familien-Kochbuch) als Ersatz/Weiterentwicklung einer bereits in Claude.ai
per Chat gebauten Version (`rezepte-shared.html`, Single-File-App mit Google-Sheets/Apps-Script-Backend).
Ziel: robusteres Backend, einfacherer Rezept-Import, neue Planungs-Features.

**Ausgangspunkt:** `index.html` in diesem Repo ist die 1:1-Kopie der alten funktionierenden Version
(Stand 2026-09-17) — Referenz für Funktionsumfang, wird schrittweise ersetzt/umgebaut.

---

## 1. Sicherheitsregeln

- Claude lädt/installiert nichts ohne ausdrückliche Freigabe des Nutzers (Malware-Vorfall in einem
  anderen Projekt hat bereits eine komplette PC-Neuinstallation gekostet — siehe globale Nutzer-Regel).
- Erlaubte Quellen: offizielle Herstellerseiten/offizielle GitHub-Repos, npm-Registry, PyPI.
- API-Keys/Secrets niemals in Code, Git oder Chat — nur in `.env` (in `.gitignore`).
- Claude erstellt **keine** Accounts bei Drittanbietern (z. B. Supabase, Hosting) — das macht der
  Nutzer selbst; Claude begleitet/erklärt nur.

---

## 2. Arbeitsweise / Workflow mit Claude

- Sprache: Deutsch.
- Kleine Schritte: erst Konzept/Plan abstimmen, dann umsetzen. Keine großen ungefragten Umbauten.
- Jede Session kurz in Abschnitt 6 (Changelog) festhalten; wichtige Entscheidungen zusätzlich im
  Obsidian-Vault unter `Entscheidungen.md`.
- Neue Feature-Ideen/Aufgaben, die der Nutzer per Nachricht oder Audio durchgibt, landen als
  Checkliste in `D:\Vault\Projects\Rezepte\Backlog.md` — dort schrittweise abgearbeitet.

---

## 3. Tech-Stack (Stand / Entscheidungen)

| Bereich | Wahl | Status |
|---|---|---|
| Bisheriges Backend | Google Sheets + Apps Script Web-App | abgelöst, nicht mehr im Einsatz |
| Neues Backend | Supabase (Postgres + Storage) | **live** — Schema + Datenmigration + Frontend-Anbindung fertig (2026-09-18) |
| Frontend | eine einzelne HTML-Datei (`index.html`) mit Vanilla-JS, spricht jetzt direkt PostgREST/Storage an | funktioniert, Modularisierung bewusst zurückgestellt |
| Versionskontrolle | Git, dieses Repo | initialisiert |
| Wissensspeicher | Obsidian, `D:\Vault\Projects\Rezepte\` | angelegt |
| Rezepte auch als Dateien | einzelne Markdown-Datei pro Rezept in Obsidian (Pfad-Struktur), zusätzlich zur DB | offen — Format/Sync-Richtung noch zu klären |

---

## 4. Bekannte Probleme der alten Version (Ausgangspunkt für den Umbau)

- ~~Bild-Upload/-Anzeige unzuverlässig (Base64 → Apps Script → Drive-Umweg).~~ **behoben** — läuft jetzt
  über Supabase Storage, im Browser getestet (2026-09-18).
- ~~API-Antworten vom Apps-Script-Backend kamen teils als zwei aneinandergehängte JSON-Objekte zurück~~
  **behoben** — Apps Script ist raus, PostgREST liefert sauberes JSON.
- Rezept manuell anlegen ist aufwändig (viele Formularfelder) — soll durch einfacheren Import ersetzt
  werden (Audio/Text-Beschreibung + Foto → automatisch strukturiertes Rezept). **noch offen.**
- Alles in einer 1169-Zeilen-HTML-Datei (Markup+CSS+JS gemischt) — nicht aufgeteilt, kein Build-Tooling.
  **noch offen**, bewusst zurückgestellt (erst Backend-Umstellung fertig, dann Struktur).

---

## 5. Geplante neue Features (siehe auch Obsidian-Backlog für Details/Status)

- "Was habe ich zuhause?" — Vorratsfeld, App schlägt passende Rezepte vor.
- Wochenplan nach Kalorien-/Proteinziel.
- Vereinfachter Rezept-Import per Audio/Text-Beschreibung + Foto.
- Rezepte zusätzlich als einzelne Dateien im Obsidian-Vault.

---

## 6. Session-Changelog

### 2026-09-17 — Session 1
- Projekt aus dem bestehenden Claude.ai-Chat-Rezeptbuch heraus neu aufgesetzt.
- `D:\Rezepte` angelegt, `index.html` (alte funktionierende Version) als Referenz reinkopiert.
- Obsidian-Vault-Ordner `D:\Vault\Projects\Rezepte` angelegt (00_Start, Entscheidungen, Backlog).
- Entscheidung: Backend-Migration von Google Sheets/Apps Script auf Supabase (Postgres + Storage).
- Nutzer hat erste Feature-Ideen durchgegeben (siehe Abschnitt 5 / Backlog) — noch keine davon umgesetzt.
- Nächster Schritt: technisches Konzept für die Supabase-Migration (Schema, Bild-Storage, Auth) und
  für das Obsidian-Rezeptdateien-Format gemeinsam abstimmen, bevor Code geschrieben wird.

### 2026-09-18 — Session 2
- Supabase-Projekt vom Nutzer angelegt, Zugangsdaten (URL + Publishable Key) in `.env` hinterlegt.
- Datenbank-Schema abgestimmt und als Migrationen umgesetzt: `recipes`/`recipe_steps`/`recipe_items`
  (normalisiert statt JSON-Blob)/`ingredients`, RLS mit offener Policy (kein Auth-System).
- Beim Sichten der echten Sheets-Daten Felder ergänzt, die im alten Formular nicht editierbar waren,
  aber in den Daten steckten: `sugar`/`fiber` bei Zutaten, `video_url` bei Rezepten, `optional`-Flag
  bei Rezept-Zutaten.
- `scripts/migrate-from-sheets.mjs`: alle Daten aus der alten Apps-Script-API nach Supabase übernommen
  — 18 Rezepte, 82 Zutaten (1 exaktes Namens-Duplikat im alten Sheet automatisch dedupliziert),
  26 Schritte, 190 Zutaten-/Gewürz-/Pool-Zeilen. 19 Zutaten-Namen aus Rezepten ohne exakten Treffer in
  der Zutatendatenbank (Freitext bleibt erhalten, nur ohne Nährwert-Verknüpfung) — Liste im Backlog.
- Storage-Bucket `recipe-images` + Policies (`0003_storage.sql`) angelegt.
- `index.html` von Google Sheets/Apps Script auf Supabase (PostgREST + Storage) umgestellt:
  `sb()`-Helper ersetzt `apiGet`/`apiPost`, `mapRecipe()` bildet das normalisierte DB-Schema wieder
  aufs alte In-Memory-Format ab (Render-/Formular-Code dadurch weitgehend unverändert), `saveRecipe()`
  schreibt Rezept+Schritte+Items einzeln, inkl. Bild-Upload in Supabase Storage.
- Rezept-IDs sind jetzt UUIDs statt Zahlen-Strings — alle Stellen gefunden und gefixt, an denen IDs
  ungequotet in `onclick`-Attribute eingebettet wurden (hätte mit Bindestrichen als Subtraktion
  geparst).
- End-to-End im Browser getestet (lokaler Dev-Server, `scripts/dev-server.mjs`, da lokale Dateien
  außerhalb des Projektordners im Browser-Tool nicht ausgeführt werden): Laden, Detail, Bearbeiten,
  Neuanlegen inkl. Bild-Upload, Löschen, Zutatendatenbank, Einkaufsliste. Dabei drei Bugs gefunden und
  gefixt — einer durch die Umstellung verursacht (inkonsistente Keys bei Massen-Insert), zwei
  vorbestehende Bugs aus der alten Version (`getSteps(null)`-Crash beim leeren Formular, "null" als
  Kategorie-Text bei leerer Kategorie).
- Nach dem Testlauf: Datenbank exakt im Ausgangszustand verifiziert (18 Rezepte/26 Schritte/190 Items).
- **Backend-Migration damit inhaltlich abgeschlossen.** Nächste offene Punkte (siehe Backlog):
  vereinfachter Rezept-Import, "Was habe ich zuhause?", Wochenplan, Obsidian-Rezeptdateien,
  Frontend-Modularisierung.
- Nutzer meldete danach: Bilder werden nicht angezeigt. Ursache gefunden — Google-Drive-Direktlinks
  (`lh3.googleusercontent.com`) antworteten nach wiederholtem Laden beim Testen mit HTTP 503
  (Rate-Limit). `scripts/migrate-images-to-storage.mjs`: alle 17 Bilder einmalig von Google Drive
  nach Supabase Storage migriert, `image_url` aktualisiert. Im echten Browser (Claude in Chrome)
  verifiziert.
- App auf **GitHub Pages** veröffentlicht, damit auch andere Familienmitglieder zugreifen können:
  Repo `Martincode27/Rezepte` (öffentlich, Nutzer hatte bereits ein GitHub-Konto — kein neuer Account
  nötig), Branch `main`, GitHub Pages auf Root aktiviert. Live unter
  https://martincode27.github.io/Rezepte/, im Browser verifiziert (Rezepte + Bilder laden korrekt).
  Hinweis dazu im Vault (`Entscheidungen.md`) und oben im Kopf dieser Datei vermerkt.
