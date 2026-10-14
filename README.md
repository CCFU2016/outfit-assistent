# My digital wardrobe – dein digitaler Kleiderschrank

Ein Schulprojekt: Du fotografierst deine eigene Kleidung, stellst Outfits zusammen
und bekommst Vorschläge, die zum Wetter passen.

Die App ist eine **Web-App (PWA)**. Sie läuft im Browser auf iPhone und Android
und lässt sich wie eine normale App auf den Startbildschirm legen.

**Online:** https://ccfu2016.github.io/outfit-assistent/

## Was macht welche Datei?

| Datei | Aufgabe |
|---|---|
| `index.html` | Das **Gerüst**: was auf dem Bildschirm steht (Kopf, drei Bereiche, Leiste unten). |
| `css/style.css` | Das **Aussehen**: Farben, Schriften, Abstände. Ganz oben stehen die App-Farben. |
| `js/app.js` | Das **Verhalten**: wechselt zwischen den Bereichen, zeigt den Installier-Tipp, meldet den Service Worker an. |
| `js/daten.js` | Die festen **Listen**: Kategorien, Wärme, Farben, Anlässe. |
| `js/speicher.js` | Das **Speichern** in der Datenbank auf dem Gerät. Nur diese Datei ändert sich, wenn später die Cloud dazukommt. |
| `js/fotos.js` | **Verkleinert** Fotos vor dem Speichern (ohne Filter, ohne Farbänderung). |
| `js/kleiderschrank.js` | Zeigt alle Teile als **Bilder**. |
| `js/teil-formular.js` | Das **Formular**: Teil anlegen, bearbeiten, löschen. |
| `sw.js` | Der **Service Worker**: legt die App-Dateien auf dem Gerät ab, damit die App schnell und auch ohne Internet startet. |
| `manifest.webmanifest` | Der **Steckbrief** der App: Name, Icon und Farben für den Startbildschirm. |
| `fonts/` | Die Schriften **Lobster Two** und **Nunito**. Sie liegen in der App selbst, es gibt keine Verbindung zu Google. |
| `icons/` | Das App-Icon (Kleiderbügel) in den Größen, die iPhone und Android brauchen. |

## Farben

| Name | Farbe | Wofür |
|---|---|---|
| Champagner-Weiß | `#FCF9F3` | Hintergrund |
| Weiß | `#FFFFFF` | Karten und die Leiste unten |
| Helles Champagner | `#F3EBDD` | zweite Buttons und Markierungen |
| Champagner | `#E3CDA4` | wichtige Buttons (mit dunkler Schrift) |
| Dunkelgrau | `#3D3833` | Text und Rahmen von Gewähltem |
| Sonnengelb, Himmelblau, Koralle | | Farbtupfer in den Symbolen |

Kleidungsfotos werden **nie** eingefärbt oder gefiltert. Die App-Farben sind nur der Rahmen.

## So kommt eine neue Version online

1. Claude Code speichert den Zwischenstand mit **git** (jeder Stand bleibt erhalten).
2. Der Stand wird zu **GitHub** hochgeladen.
3. **GitHub Pages** veröffentlicht ihn automatisch, das dauert etwa eine Minute.

Unten in der App steht die Versionsnummer. Daran erkennst du, ob die neue Version
schon auf deinem Handy angekommen ist.

## Fortschritt

- [x] 1.0 Grundgerüst: Design, drei Bereiche, installierbar
- [x] 1.1 Kleidungsstück erfassen: Foto, Angaben, bearbeiten, löschen
- [ ] 1.2 Kleiderschrank und Outfit
- [ ] 1.3 Wettervorschlag
- [ ] 1.4 Sicherung speichern und laden

## Lizenzen

Schriften: Lobster Two und Nunito, beide unter der SIL Open Font License 1.1
(siehe `fonts/OFL-*.txt`).
