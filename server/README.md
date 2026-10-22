# Mon Dressing – Server für „Automatisch erkennen“

Dieser kleine Server ist der „Türsteher“ zwischen der App und Claude:
Die App schickt das Foto eines Kleidungsstücks, der Server fragt Claude (Modell **Sonnet**)
und schickt Kategorie, Farbe, Wärme, regenfest und einen Namen zurück.

**Der API-Schlüssel liegt nur hier auf dem Server** (bei Railway als Variable).
Er steht nie in der App, nie auf GitHub und gehört auch nie in einen Chat.

## Schutz gegen fremde Nutzung

1. **Zugangscode:** Ohne den richtigen Code gibt es keine Antwort.
2. **Tageslimit:** höchstens 100 Fotos pro Tag (Variable `TAGESLIMIT`).
   Der Zähler liegt im Arbeitsspeicher und beginnt nach einem Neustart des Servers von vorn.
3. **Nur die App darf aus dem Browser fragen** (Variable `ERLAUBTE_HERKUNFT`).
4. **Das Modell steht im Code fest** (Sonnet). Die App kann es nicht ändern.
5. **Notbremse:** Ausgabenlimit in der Anthropic-Konsole (siehe unten).

## Einrichten bei Railway (einmalig, von einem Erwachsenen)

1. Auf **railway.com** anmelden und **New Project → Deploy from GitHub repo** wählen,
   dann das Repository `CCFU2016/outfit-assistent` aussuchen
   (Railway fragt dabei nach Zugriff auf das Repository).
2. Im neuen Dienst unter **Settings**:
   - **Root Directory:** `server`
   - **Watch Paths** (wenn vorhanden): `server/**`. Dann startet der Server nur neu,
     wenn sich wirklich der Server ändert.
3. Unter **Variables** eintragen:
   | Name | Wert |
   |---|---|
   | `CLAUDE_API_SCHLUESSEL` | der API-Schlüssel von Anthropic (am besten ein eigener nur für diese App) |
   | `ZUGANGSCODE` | ein selbst ausgedachter Code, mindestens 12 Zeichen, z. B. drei Wörter mit Zahl |
   | `TAGESLIMIT` | `100` (darf auch fehlen, dann gilt 100) |
4. Unter **Settings → Networking → Generate Domain** eine Adresse erzeugen,
   z. B. `https://irgendwas.up.railway.app`.
5. **Testen:** Die Adresse im Browser öffnen. Dort muss stehen:
   `{"ok":true,"dienst":"Mon Dressing"}`
6. **Claude die Adresse sagen** (nur die Adresse, nicht den Schlüssel und nicht den Code).
   Sie kommt in `js/verbindung.js` (`SERVER_ADRESSE`). Danach erscheint in der App
   unten in der Garderobe die Karte „Automatisch erkennen“. Dort tippt man den Zugangscode einmal ein.

## Anmeldung einschalten: Datenbank hinzufügen (einmalig)

1. Im Railway-Projekt: **+ Create** (oder **New**) → **Database** → **PostgreSQL**.
2. Im **Server-Dienst** unter **Variables** eine neue Variable anlegen:
   `DATABASE_URL` mit dem Wert `${{Postgres.DATABASE_URL}}`
   (Railway bietet sie auch als „Reference Variable“ zum Auswählen an).
3. Der Server startet neu und legt die Tabellen selbst an. Die Adresse im Browser zeigt dann
   `"anmeldung":true`, und in der App erscheint unten in der Garderobe die Karte „Dein Konto“.
4. Ein Konto anlegen geht nur mit dem **Einladungscode**. Das ist der `ZUGANGSCODE`.

### Passwort vergessen (bis es das Zurücksetzen per E-Mail gibt)

Solange in der Cloud noch keine Stücke gespeichert werden, geht dabei nichts verloren:
1. Bei Railway die Postgres-Datenbank öffnen → **Data** → Tabelle `konten`.
2. Die Zeile mit der E-Mail löschen (die Anmeldungen in `sitzungen` verschwinden automatisch mit).
3. In der App mit derselben E-Mail ein neues Konto anlegen.

## In der Anthropic-Konsole (Notbremse)

- Einen **eigenen API-Schlüssel** nur für diese App anlegen (z. B. „mon-dressing“).
  Dann kann man ihn jederzeit löschen, ohne dass etwas anderes kaputtgeht.
- Ein **monatliches Ausgabenlimit** einstellen, z. B. 5 $. Mehr kann es dann nie kosten.

## Wenn etwas schiefgeht

- **Der Code ist bekannt geworden?** Bei Railway einen neuen `ZUGANGSCODE` eintragen
  und in der App den neuen Code eingeben.
- **Der Schlüssel ist bekannt geworden?** In der Anthropic-Konsole löschen, einen neuen anlegen
  und bei Railway eintragen.
- **Logs:** Railway zeigt unter „Deployments → Logs“ pro Foto eine Zeile mit den verbrauchten Token.
  Fotos und Schlüssel werden nie ins Log geschrieben.

## Für Entwickler

```bash
cd server
npm install
CLAUDE_API_SCHLUESSEL=… ZUGANGSCODE=… ERLAUBTE_HERKUNFT=http://localhost:8765 npm start
```

Mit Datenbank zusätzlich `DATABASE_URL=postgres://…` setzen.

Endpunkte:
- `GET /` → `{ ok, dienst, anmeldung }` (`anmeldung: true`, wenn die Datenbank verbunden ist)
- `POST /konto/registrieren` mit `{ email, passwort, einladungscode }` → `{ token, email }`
- `POST /konto/anmelden` mit `{ email, passwort }` → `{ token, email }`
- `POST /konto/abmelden`, `GET /konto/ich` (mit `Authorization: Bearer <token>`)

Erkennen und Prüfen (mit `Authorization: Bearer <token>` oder Kopfzeile `X-Zugangscode`):
- `POST /erkennen` mit `{ "bild": "data:image/jpeg;base64,…" }` →
  `{ istKleidung, kategorie, art, farbe, waerme, regenfest, name, uebrigHeute }`
- `POST /pruefen` → `{ ok: true, uebrigHeute }` (prüft nur den Code, kostet nichts)
