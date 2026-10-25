// server.js – der „Türsteher“ zwischen der App, der Datenbank und Claude
//
// Teile:
//   erkennen.js   Claude fragt, was auf dem Foto ist (der API-Schlüssel bleibt hier auf dem Server)
//   konten.js     Konto anlegen, anmelden, abmelden
//   cloud.js      die Garderobe in der Cloud (Stücke mit Fotos, „Heute getragen“)
//   datenbank.js  Verbindung zur Datenbank bei Railway
//
// Schutz gegen fremde Nutzung:
//   1. Anmeldung (oder für den Übergang: Zugangscode). Ein Konto anlegen geht nur mit Einladungscode.
//   2. Tageslimit: höchstens TAGESLIMIT Fotos pro Tag
//   3. Nur unsere App-Adresse darf aus dem Browser fragen (ERLAUBTE_HERKUNFT)
//   4. Zu viele falsche Versuche → eine Viertelstunde Pause
//   5. Zusätzlich: Ausgabenlimit in der Anthropic-Konsole (die Notbremse)
//
// Einstellungen bei Railway (Variables):
//   CLAUDE_API_SCHLUESSEL  der API-Schlüssel von Anthropic (geheim!)
//   ZUGANGSCODE            Einladungscode zum Konto-Anlegen (und für den Übergang: Code für die Erkennung) (geheim!)
//   DATABASE_URL           kommt von der Postgres-Datenbank bei Railway (ohne sie: keine Konten)
//   ERLAUBTE_HERKUNFT      Adresse der App, Standard: https://ccfu2016.github.io
//   TAGESLIMIT             Fotos pro Tag, Standard: 100
//   PORT                   setzt Railway selbst

import http from "node:http";
import crypto from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { MODELL, erkenne } from "./erkennen.js";
import { datenbankVorhanden, tabellenAnlegen } from "./datenbank.js";
import { KontoFehler, registrieren, anmelden, abmelden, kontoZumToken, bremse, fehlversuch } from "./konten.js";
import { speichern, aenderungen, fotos } from "./cloud.js";

const PORT = Number(process.env.PORT) || 3000;
const ZUGANGSCODE = process.env.ZUGANGSCODE || "";
// Nur der Anfang der Adresse zählt ("https://ccfu2016.github.io"). Steht dort aus Versehen mehr,
// z. B. "https://ccfu2016.github.io/outfit-assistent/", wird es hier abgeschnitten.
const ERLAUBTE_HERKUNFT = (process.env.ERLAUBTE_HERKUNFT || "https://ccfu2016.github.io").split(",").map((eintrag) => {
  try {
    return new URL(eintrag.trim()).origin;
  } catch {
    return eintrag.trim();
  }
});
const TAGESLIMIT = Number(process.env.TAGESLIMIT) || 100;
const MAX_ANFRAGE_BYTES = 1.5 * 1024 * 1024; // das Vorschaubild hat meist unter 100 KB
const MAX_CLOUD_BYTES = 5 * 1024 * 1024;    // ein Stück mit großem Foto hat meist unter 1 MB

if (!process.env.CLAUDE_API_SCHLUESSEL || !ZUGANGSCODE) {
  console.error("Es fehlen Variablen: CLAUDE_API_SCHLUESSEL und ZUGANGSCODE müssen bei Railway eingetragen sein.");
  process.exit(1);
}

// ---------- Tageslimit (zählt im Arbeitsspeicher, beginnt jeden Tag neu) ----------
const zaehler = { tag: "", anzahl: 0 };
function heute() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }); // "2026-10-15"
}
function nochErlaubt() {
  if (zaehler.tag !== heute()) {
    zaehler.tag = heute();
    zaehler.anzahl = 0;
  }
  return zaehler.anzahl < TAGESLIMIT;
}

// ---------- Hilfen ----------
function codeStimmt(code) {
  const a = Buffer.from(String(code || ""));
  const b = Buffer.from(ZUGANGSCODE);
  return a.length === b.length && crypto.timingSafeEqual(a, b); // vergleicht ohne Zeit-Hinweise
}

// Die Adresse des Geräts (Railway hängt sie hinten an X-Forwarded-For an)
function ipVon(anfrage) {
  const weitergeleitet = String(anfrage.headers["x-forwarded-for"] || "").split(",").map((s) => s.trim()).filter(Boolean);
  return weitergeleitet.at(-1) || anfrage.socket.remoteAddress || "?";
}

function tokenVon(anfrage) {
  const treffer = /^Bearer (.+)$/.exec(anfrage.headers.authorization || "");
  return treffer ? treffer[1].trim() : null;
}

function antworte(antwort, herkunft, status, inhalt) {
  const kopf = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
  if (ERLAUBTE_HERKUNFT.includes(herkunft)) {
    kopf["Access-Control-Allow-Origin"] = herkunft;
    kopf["Access-Control-Allow-Headers"] = "Content-Type, X-Zugangscode, Authorization";
    kopf["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
    kopf["Vary"] = "Origin";
  }
  antwort.writeHead(status, kopf);
  antwort.end(inhalt === undefined ? "" : JSON.stringify(inhalt));
}

function leseKoerper(anfrage, maxBytes) {
  return new Promise((fertig, fehler) => {
    const teile = [];
    let groesse = 0;
    anfrage.on("data", (stueck) => {
      groesse += stueck.length;
      if (groesse <= maxBytes) teile.push(stueck); // zu viel? Den Rest bis zum Ende nur überspringen,
      else if (groesse > 10 * maxBytes) anfrage.destroy(); // damit die App eine Antwort bekommt (bei Unsinn: auflegen)
    });
    anfrage.on("end", () => (groesse > maxBytes
      ? fehler(new KontoFehler(413, "Das ist zu groß."))
      : fertig(Buffer.concat(teile).toString("utf8"))));
    anfrage.on("error", fehler);
  });
}

async function leseJson(anfrage, maxBytes = MAX_ANFRAGE_BYTES) {
  try {
    return JSON.parse((await leseKoerper(anfrage, maxBytes)) || "{}");
  } catch (fehler) {
    if (fehler instanceof KontoFehler) throw fehler;
    throw new KontoFehler(400, "Die Anfrage ist kaputt.");
  }
}

// Darf diese Anfrage Claude benutzen? Angemeldet ODER (für den Übergang) richtiger Zugangscode.
async function darfErkennen(anfrage, ip) {
  if (datenbankVorhanden && (await kontoZumToken(tokenVon(anfrage)))) return true;
  bremse(`ip:${ip}`);
  if (codeStimmt(anfrage.headers["x-zugangscode"])) return true;
  fehlversuch(`ip:${ip}`);
  console.log("Abgelehnt: weder angemeldet noch richtiger Zugangscode"); // den Code selbst schreiben wir nie ins Protokoll
  return false;
}

function brauchtDatenbank() {
  if (!datenbankVorhanden) throw new KontoFehler(503, "Die Anmeldung ist auf dem Server noch nicht eingerichtet.");
}

// Wer fragt? Das Konto zum Anmelde-Schlüssel, sonst „Bitte melde dich neu an“
async function angemeldetesKonto(anfrage) {
  brauchtDatenbank();
  const konto = await kontoZumToken(tokenVon(anfrage));
  if (!konto) throw new KontoFehler(401, "Bitte melde dich neu an.");
  return konto;
}

function suchwert(anfrage, name) {
  return new URL(anfrage.url, "http://x").searchParams.get(name);
}

// ---------- Die einzelnen Adressen ----------
const wege = {
  "GET /": async () => [200, { ok: true, dienst: "Mon Dressing", anmeldung: datenbankVorhanden }],

  "POST /konto/registrieren": async (anfrage, ip) => {
    brauchtDatenbank();
    return [201, await registrieren(await leseJson(anfrage), ip, codeStimmt)];
  },

  "POST /konto/anmelden": async (anfrage, ip) => {
    brauchtDatenbank();
    return [200, await anmelden(await leseJson(anfrage), ip)];
  },

  "POST /konto/abmelden": async (anfrage) => {
    brauchtDatenbank();
    await abmelden(tokenVon(anfrage));
    return [200, { ok: true }];
  },

  "GET /konto/ich": async (anfrage) => {
    const konto = await angemeldetesKonto(anfrage);
    return [200, { email: konto.email }];
  },

  // ---------- Cloud (nur angemeldet) ----------
  "POST /cloud/speichern": async (anfrage) => {
    const konto = await angemeldetesKonto(anfrage);
    return [200, await speichern(konto.id, await leseJson(anfrage, MAX_CLOUD_BYTES))];
  },

  "GET /cloud/aenderungen": async (anfrage) => {
    const konto = await angemeldetesKonto(anfrage);
    const seit = Math.max(0, Math.floor(Number(suchwert(anfrage, "seit")) || 0));
    return [200, await aenderungen(konto.id, seit)];
  },

  "GET /cloud/fotos": async (anfrage) => {
    const konto = await angemeldetesKonto(anfrage);
    return [200, await fotos(konto.id, suchwert(anfrage, "id"))];
  },

  // Nur prüfen, ob man erkennen darf (beim Einrichten in der App): kostet nichts und zählt nicht
  "POST /pruefen": async (anfrage, ip) => {
    if (!(await darfErkennen(anfrage, ip))) throw new KontoFehler(401, "Der Zugangscode stimmt nicht.");
    nochErlaubt(); // stellt den Zähler auf heute
    return [200, { ok: true, uebrigHeute: TAGESLIMIT - zaehler.anzahl }];
  },

  "POST /erkennen": async (anfrage, ip) => {
    if (!(await darfErkennen(anfrage, ip))) throw new KontoFehler(401, "Der Zugangscode stimmt nicht.");
    if (!nochErlaubt()) throw new KontoFehler(429, `Für heute sind alle ${TAGESLIMIT} Erkennungen verbraucht. Morgen geht es wieder.`);

    const { bild } = await leseJson(anfrage);
    const treffer = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(bild || "");
    if (!treffer) throw new KontoFehler(400, "Das ist kein Foto.");

    zaehler.anzahl++; // zählt auch, wenn Claude danach scheitert: Kosten können trotzdem entstehen
    const { ergebnis, fehler } = await erkenne(treffer[1], treffer[2]);
    if (fehler) throw new KontoFehler(502, fehler);
    return [200, { ...ergebnis, uebrigHeute: TAGESLIMIT - zaehler.anzahl }];
  },
};

// ---------- Der Server ----------
const server = http.createServer(async (anfrage, antwort) => {
  const herkunft = anfrage.headers.origin || "";
  const pfad = new URL(anfrage.url, "http://x").pathname;
  const ip = ipVon(anfrage);

  if (anfrage.method === "OPTIONS") return antworte(antwort, herkunft, 204); // Vorab-Frage des Browsers
  const weg = wege[`${anfrage.method} ${pfad}`];
  if (!weg) return antworte(antwort, herkunft, 404, { fehler: "Gibt es nicht." });

  if (herkunft && !ERLAUBTE_HERKUNFT.includes(herkunft)) {
    console.log(`Abgelehnt: Anfrage von ${herkunft} (erlaubt ist nur ${ERLAUBTE_HERKUNFT.join(", ")})`);
    return antworte(antwort, herkunft, 403, { fehler: "Nicht erlaubt." });
  }

  try {
    const [status, inhalt] = await weg(anfrage, ip);
    return antworte(antwort, herkunft, status, inhalt);
  } catch (fehler) {
    if (fehler instanceof KontoFehler) return antworte(antwort, herkunft, fehler.status, { fehler: fehler.message });
    if (fehler instanceof Anthropic.RateLimitError) return antworte(antwort, herkunft, 503, { fehler: "Claude ist gerade überlastet. Versuch es gleich noch einmal." });
    if (fehler instanceof Anthropic.APIError) {
      console.error(`Claude-Fehler ${fehler.status}`); // ohne Details: dort könnte Privates stehen
      return antworte(antwort, herkunft, 502, { fehler: "Claude ist gerade nicht erreichbar." });
    }
    console.error(`Unerwarteter Fehler bei ${anfrage.method} ${pfad}:`, fehler.message);
    return antworte(antwort, herkunft, 500, { fehler: "Da ist etwas schiefgegangen." });
  }
});

try {
  await tabellenAnlegen();
} catch (fehler) {
  console.error("Die Datenbank ist nicht erreichbar:", fehler.message);
  process.exit(1);
}
server.listen(PORT, () => console.log(`Mon Dressing Server läuft auf Port ${PORT} (Modell ${MODELL}, Tageslimit ${TAGESLIMIT}, ` +
  `erlaubte App: ${ERLAUBTE_HERKUNFT.join(", ")}, Anmeldung: ${datenbankVorhanden ? "an" : "aus (keine DATABASE_URL)"})`));
