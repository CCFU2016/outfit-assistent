# Outfit-Assistent – dein digitaler Kleiderschrank ("Vera's app")

A school project (started 2026-10-13): photograph your own clothes, build outfits, get weather-based suggestions.
Target users are teens/young adults. A phone-first PWA (iPhone + Android), German UI. Full brief and decision log:
`~/outfit-assistent-brief.md`. It is kept OUT of this public repo because it has personal details; do not copy its contents here.

## How to work with the person on this project

- They write German and say they have never programmed: explain every step simply in German (du), in small steps.
- After each step say how they can test it themselves, ask before bigger decisions, show a plan and wait for OK.
- They often steer from an iPad via Remote Control: say explicitly when something must be done at the MacBook.
- Flag iPhone-vs-Android differences. They react visually and quickly: show screenshots and iterate.

## Stack

Plain HTML/CSS/JS ES modules, no framework, no build step, no dependencies. Data lives in IndexedDB on the device
(`js/speicher.js` is the only storage module, so a cloud backend can replace it later). Service worker `sw.js` for offline use.
Weather: Open-Meteo forecast + geocoding (no key needed). Fonts (Lobster Two, Nunito) are self-hosted in `fonts/`, never loaded from Google.

## Run locally

Launch config `outfit-assistent` (in `~/.claude/launch.json`): `python3 -m http.server 5030 --directory ~/outfit-assistent`, http://localhost:5030.
No test suite. Testing gotcha: in the Browser pane `location.reload()` can serve stale CSS/JS; open the URL with a fresh `?x=N` query instead.

## Deploy

GitHub Pages from the public repo `CCFU2016/outfit-assistent` (SSH remote), live at https://ccfu2016.github.io/outfit-assistent/.
Publishing a version = commit and push to `main`; Pages updates in about a minute.
Each deploy: bump `VERSION` in `js/app.js` (shown at the bottom of the app) and the cache name `SPEICHER_NAME` in `sw.js` when cached files change.
Repo-local git identity is the CCFU2016 noreply email (global git identity is empty). Do not change the existing `gh` login (CCFU2016).

## Status

Working branch `schritt-1-2-outfit` (VERSION 0.4, pushed, not merged). `main` was live v0.3 as of 2026-10-13. If work resumes, `git pull` first.
README checklist: 1.0 and 1.1 done; 1.2 (Kleiderschrank filter, Outfit, "Heute getragen"), 1.3 (Wettervorschlag) and 1.4 (Sicherung: export/import file, iPhone via share sheet) open.
`js/wetter.js` and `js/ort-auswahl.js` already exist. TODO: confirm with Niki how far 1.3 is and whether 1.2 can be merged to `main`.

## Key files

`index.html`, `css/style.css` (app colours at the top), `js/app.js` (hash router, install hint, service worker), `js/daten.js` (fixed lists),
`js/speicher.js`, `js/fotos.js` (resize to 1280 px + 480 px thumbnail), `js/kleiderschrank.js`, `js/teil-formular.js`, `js/outfit.js`, `js/wetter.js`, `js/bilder.js`.

## Design and hard rules

- Colours: Mokka #5C4033 for text and main buttons, background #FCF9F3, white cards with soft shadow, light champagne #F3EBDD for secondary buttons. Coloured symbols (sun, cloud, shirt). Clothing photos are NEVER tinted or filtered.
- Any Claude API key (a later Schritt 3) must never be in app code or the browser; it needs a small server. Never set ANTHROPIC_API_KEY in Niki's terminal.
- Do NOT build: AI garment recognition, 3D avatar, body scan, shopping, social features. Schritt 2 is a 2D dress-up figure; present background-removal options before building.
- Deadlines: Schritt 1 results by 2026-10-15; finished by the Berlin winter holidays (early Feb 2027).
