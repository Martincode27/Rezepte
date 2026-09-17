# CLAUDE.md — Projekt "Rezepte"

> Diese Datei wird von Claude Code zu Beginn **jeder** Session automatisch gelesen.
> Sie ist das verbindliche Regelwerk und der zentrale Wissensspeicher für dieses Projekt.
> Claude: Aktualisiere Abschnitt 6 (Changelog) am Ende jeder Session.

Wissensspeicher/Notizen (Backlog, Entscheidungen, Journal) liegen **nicht** hier, sondern im
projektübergreifenden Obsidian-Vault unter **`D:\Vault\Projects\Rezepte\`** (eigenes Git-Repo,
getrennt von diesem Code-Repo) — analog zum TradingBot-Projekt.

Zuletzt aktualisiert: 2026-09-17

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
| Bisheriges Backend | Google Sheets + Apps Script Web-App | wird abgelöst |
| Neues Backend | Supabase (Postgres + Storage) | Entscheidung getroffen, Umsetzung offen |
| Frontend | bislang eine einzelne HTML-Datei mit Vanilla-JS | wird bei Umbau modularisiert |
| Versionskontrolle | Git, dieses Repo | initialisiert |
| Wissensspeicher | Obsidian, `D:\Vault\Projects\Rezepte\` | angelegt |
| Rezepte auch als Dateien | einzelne Markdown-Datei pro Rezept in Obsidian (Pfad-Struktur), zusätzlich zur DB | offen — Format/Sync-Richtung noch zu klären |

---

## 4. Bekannte Probleme der alten Version (Ausgangspunkt für den Umbau)

- Bild-Upload/-Anzeige unzuverlässig (Base64 → Apps Script → Drive-Umweg).
- API-Antworten vom Apps-Script-Backend kamen teils als zwei aneinandergehängte JSON-Objekte zurück
  (`apiGet`/`apiPost` in `index.html` enthalten einen `}{`-Split-Hack als Workaround) — Hinweis auf
  ein unzuverlässiges Backend, nicht nur ein Frontend-Detail.
- Rezept manuell anlegen ist aufwändig (viele Formularfelder) — soll durch einfacheren Import ersetzt
  werden (Audio/Text-Beschreibung + Foto → automatisch strukturiertes Rezept).
- Alles in einer 1169-Zeilen-HTML-Datei (Markup+CSS+JS gemischt) — nicht aufgeteilt, kein Build-Tooling.

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
