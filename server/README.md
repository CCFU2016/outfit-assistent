# Mon Dressing – Server für Anmeldung, Cloud und „Automatisch erkennen“

Dieser kleine Server ist der „Türsteher“ zwischen der App, der Datenbank und Claude:
- **Anmeldung:** Konten (nur mit Einladungscode).
- **Cloud:** Speichert die Stücke mit Fotos und „Heute getragen“, damit sie auf allen Geräten gleich sind.
- **Erkennen:** Die App schickt das Foto eines Kleidungsstücks, der Server fragt Claude (Modell **Sonnet**)
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

1. Bei Railway die Postgres-Datenbank öffnen → **Data** → Tabelle `konten`.
2. Die Zeile mit der E-Mail löschen. Damit verschwinden auch die Anmeldungen (`sitzungen`)
   **und die Cloud-Kopie** (`cloud`) dieses Kontos.
3. In der App mit derselben E-Mail ein neues Konto anlegen.
4. Die Stücke auf den Geräten bleiben erhalten. Beim ersten Abgleich mit dem neuen Konto lädt jedes Gerät
   seine Stücke wieder hoch. Dafür muss sich jedes Gerät einmal neu anmelden.

## Die Cloud

- Tabelle `cloud`: pro Konto jedes Stück (mit Foto und Vorschaubild als Text) und jeder „Heute getragen“-Tag.
- Gibt es dasselbe Stück auf zwei Geräten verschieden, **gewinnt die neueste Änderung**.
- Gelöschtes bleibt als „gelöscht“ stehen (ohne Fotos), damit es auch auf den anderen Geräten verschwindet.
- **Sicherung der Datenbank:** Bei Railway beim Postgres-Dienst unter **Backups** regelmäßige Sicherungen
  einschalten (falls es das in eurem Tarif gibt). Zusätzlich kann man in der App eine Sicherung als Datei speichern.

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

Cloud (mit `Authorization: Bearer <token>`):
- `POST /cloud/speichern` mit `{ art: "teil"|"getragen", id, geaendertAm, daten, foto, vorschau }`
  oder `{ art, id, geaendertAm, geloescht: true }` → `{ uebernommen }` (false, wenn schon Neueres da ist)
- `GET /cloud/aenderungen?seit=<stand>` → `{ konto, eintraege: [{ art, id, daten, geloescht, geaendertAm }], stand, mehr }`
- `GET /cloud/fotos?id=<id>` → `{ foto, vorschau }` (als `data:image/jpeg;base64,…`)

Erkennen und Prüfen (mit `Authorization: Bearer <token>` oder Kopfzeile `X-Zugangscode`):
- `POST /erkennen` mit `{ "bild": "data:image/jpeg;base64,…" }` →
  `{ istKleidung, kategorie, art, farbe, waerme, regenfest, name, uebrigHeute }`
- `POST /pruefen` → `{ ok: true, uebrigHeute }` (prüft nur den Code, kostet nichts)
