# Mon Dressing Raffiné – deine digitale Garderobe

Ein Schulprojekt: Du fotografierst deine eigene Kleidung, stellst Looks zusammen
und bekommst Vorschläge, die zum Wetter passen und farblich zusammenpassen.

Die App ist eine **Web-App (PWA)**. Sie läuft im Browser auf iPhone und Android
und lässt sich wie eine normale App auf den Startbildschirm legen.

**Online:** https://ccfu2016.github.io/outfit-assistent/

## Was macht welche Datei?

| Datei | Aufgabe |
|---|---|
| `index.html` | Das **Gerüst**: was auf dem Bildschirm steht (Kopf, drei Bereiche, Leiste unten). |
| `css/style.css` | Das **Aussehen**: Farben, Schriften, Abstände. Ganz oben stehen die App-Farben. |
| `js/app.js` | Das **Verhalten**: wechselt zwischen den Bereichen, zeigt den Installier-Tipp, meldet den Service Worker an. |
| `js/daten.js` | Die festen **Listen**: Kategorien, Arten von Accessoires, Wärme, Farben, Anlässe. |
| `js/speicher.js` | Das **Speichern** in der Datenbank auf dem Gerät. Nur diese Datei ändert sich, wenn später die Cloud dazukommt. |
| `js/fotos.js` | **Verkleinert** Fotos vor dem Speichern (ohne Filter, ohne Farbänderung). |
| `js/kleiderschrank.js` | Die **Garderobe**: zeigt alle Stücke als Bilder, mit Filter. |
| `js/teil-formular.js` | Das **Formular**: Stück anlegen, bearbeiten, löschen. |
| `js/outfit.js` | **Look** zusammenstellen, „Look des Tages“ speichern, „Deine Looks“. |
| `js/wetter.js`, `js/ort-auswahl.js` | **Wetter** von Open-Meteo und der Ort dafür. |
| `js/wetter-seite.js` | Der Bereich **Wetter & Looks**: 5 Tage mit Vorschlag. |
| `js/vorschlag.js` | Sucht den **Vorschlag** aus: Wetter vor Farben vor Abwechslung. |
| `js/kombi.js` | Die **Farb-Regeln**: höchstens 3 Farben, passende Tasche. |
| `sw.js` | Der **Service Worker**: legt die App-Dateien auf dem Gerät ab, damit die App schnell und auch ohne Internet startet. |
| `manifest.webmanifest` | Der **Steckbrief** der App: Name, Icon und Farben für den Startbildschirm. |
| `fonts/` | Die Schriften **Bodoni Moda** (Überschriften) und **Jost** (Text). Sie liegen in der App selbst, es gibt keine Verbindung zu Google. |
| `icons/` | Das App-Icon (Kleiderbügel) in den Größen, die iPhone und Android brauchen. |

## Design

Edel und schlicht, angelehnt an Modemarken wie Mauré und Ralph Lauren:
viel Weiß, fast Schwarz, ein zartes Grau-Beige, fast eckige Formen (3 px)
und Symbole in Schwarz-Grau.

| Name | Farbe | Wofür |
|---|---|---|
| Weiß | `#FFFFFF` | Hintergrund, Karten und die Leiste unten |
| Helles Grau-Beige | `#F3F0EB` | zweite Buttons und Markierungen |
| Grau-Beige | `#BAB3A9` | wichtige Buttons (mit dunkler Schrift) |
| Fast Schwarz | `#1C1C1C` | Text, Symbole und Rahmen von Gewähltem |
| Grau | `#6F6A64` | Nebentexte, Sonnenstrahlen und Regentropfen |

Schriften: **Bodoni Moda** für den App-Namen (in Großbuchstaben) und die Überschriften,
**Jost** für alles andere.

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
- [x] 1.2 Kleiderschrank und Outfit
- [x] 1.3 Wetter und Vorschläge für heute und die nächsten 4 Tage
- [x] Farben und Taschen passend kombinieren (höchstens 3 Farben)
- [x] Neuer Name „Mon Dressing Raffiné“ und neuer Look
- [ ] 1.4 Sicherung speichern und laden

## Lizenzen

Schriften: Bodoni Moda und Jost, beide unter der SIL Open Font License 1.1
(siehe `fonts/OFL-*.txt`).
