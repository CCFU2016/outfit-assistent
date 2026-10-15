// server.js – der „Türsteher“ zwischen der App und Claude
//
// Die App schickt ein Foto, der Server fragt Claude: Was ist das für ein Kleidungsstück?
// Der API-Schlüssel liegt NUR hier auf dem Server (bei Railway als Variable),
// nie in der App, nie auf GitHub.
//
// Schutz gegen fremde Nutzung:
//   1. Zugangscode: ohne den richtigen Code keine Antwort
//   2. Tageslimit: höchstens TAGESLIMIT Fotos pro Tag
//   3. Nur unsere App-Adresse darf aus dem Browser fragen (ERLAUBTE_HERKUNFT)
//   4. Das Modell steht hier fest (Sonnet), die App kann es nicht ändern
//   5. Zusätzlich: Ausgabenlimit in der Anthropic-Konsole (die Notbremse)
//
// Einstellungen bei Railway (Variables):
//   CLAUDE_API_SCHLUESSEL  der API-Schlüssel von Anthropic (geheim!)
//   ZUGANGSCODE            der Code, den man einmal in der App eintippt (geheim!)
//   ERLAUBTE_HERKUNFT      Adresse der App, Standard: https://ccfu2016.github.io
//   TAGESLIMIT             Fotos pro Tag, Standard: 100
//   PORT                   setzt Railway selbst

import http from "node:http";
import crypto from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import * as z from "zod/v4";

const MODELL = "claude-sonnet-5-5"; // fest: nicht teurer als Sonnet
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

if (!process.env.CLAUDE_API_SCHLUESSEL || !ZUGANGSCODE) {
  console.error("Es fehlen Variablen: CLAUDE_API_SCHLUESSEL und ZUGANGSCODE müssen bei Railway eingetragen sein.");
  process.exit(1);
}

const claude = new Anthropic({ apiKey: process.env.CLAUDE_API_SCHLUESSEL });

// ---------- Die festen Listen (genau wie in js/daten.js der App) ----------
const KATEGORIEN = ["oberteil", "hose-rock", "kleid", "jacke", "schuhe", "accessoire"];
const ACCESSOIRE_ARTEN = ["tasche", "muetze-schal", "schmuck", "guertel", "sonstiges"];
const WAERME = ["leicht", "mittel", "warm"];
const FARBEN = ["schwarz", "weiss", "grau", "beige", "braun", "dunkelblau", "blau", "hellblau",
  "gruen", "oliv", "rot", "rosa", "lila", "gelb", "orange", "bunt"];

// So soll Claudes Antwort aussehen (die API hält sich garantiert daran)
const ERGEBNIS = z.object({
  istKleidung: z.boolean(),
  kategorie: z.enum(KATEGORIEN),
  art: z.enum(ACCESSOIRE_ARTEN).nullable(),
  farbe: z.enum(FARBEN),
  waerme: z.enum(WAERME),
  regenfest: z.boolean(),
  name: z.string(),
});

const ANLEITUNG = `Du hilfst bei einer Garderoben-App für Jugendliche. Auf dem Foto ist (meistens) ein einzelnes Kleidungsstück.
Bestimme:
- istKleidung: false, wenn auf dem Foto kein Kleidungsstück, keine Schuhe und kein Accessoire zu sehen ist. Dann fülle die anderen Felder trotzdem mit einer Vermutung.
- kategorie: oberteil (Shirt, Bluse, Pulli, Hoodie, Top), hose-rock (Hosen, Jeans, Shorts, Röcke), kleid (Kleider, Jumpsuits), jacke (Jacken, Mäntel, Westen), schuhe, accessoire (Tasche, Mütze, Schal, Schmuck, Gürtel, Sonstiges).
- art: nur bei kategorie accessoire: tasche, muetze-schal, schmuck, guertel oder sonstiges. Sonst null.
- farbe: die Hauptfarbe des Stücks (nicht des Hintergrunds). "bunt" für gemusterte oder sehr mehrfarbige Stücke. "dunkelblau" für typische Jeans und Navy.
- waerme: leicht (für ab ca. 20 °C, z. B. T-Shirt, Top, Shorts, Sandalen), mittel (ca. 12–20 °C, z. B. Langarmshirt, Jeans, Sneaker, leichte Jacke), warm (unter 12 °C, z. B. dicker Pulli, Wintermantel, Stiefel, Wollmütze).
- regenfest: true nur bei Regenjacken, Gummistiefeln oder deutlich wasserabweisendem Material, sonst false.
- name: kurzer deutscher Name mit Farbe, höchstens 3 Wörter, z. B. "Blaue Jeans", "Weißer Hoodie", "Schwarze Lederjacke".`;

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

function antworte(antwort, herkunft, status, inhalt) {
  const kopf = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
  if (ERLAUBTE_HERKUNFT.includes(herkunft)) {
    kopf["Access-Control-Allow-Origin"] = herkunft;
    kopf["Access-Control-Allow-Headers"] = "Content-Type, X-Zugangscode";
    kopf["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    kopf["Vary"] = "Origin";
  }
  antwort.writeHead(status, kopf);
  antwort.end(inhalt === undefined ? "" : JSON.stringify(inhalt));
}

function leseKoerper(anfrage) {
  return new Promise((fertig, fehler) => {
    const teile = [];
    let groesse = 0;
    anfrage.on("data", (stueck) => {
      groesse += stueck.length;
      if (groesse <= MAX_ANFRAGE_BYTES) teile.push(stueck); // zu viel? Den Rest bis zum Ende nur überspringen,
      else if (groesse > 10 * MAX_ANFRAGE_BYTES) anfrage.destroy(); // damit die App eine Antwort bekommt (bei Unsinn: auflegen)
    });
    anfrage.on("end", () => (groesse > MAX_ANFRAGE_BYTES
      ? fehler(Object.assign(new Error("zu groß"), { status: 413 }))
      : fertig(Buffer.concat(teile).toString("utf8"))));
    anfrage.on("error", fehler);
  });
}

// ---------- Claude fragen ----------
async function erkenne(medienTyp, daten) {
  const nachricht = await claude.messages.parse({
    model: MODELL,
    max_tokens: 2000, // Denken zählt mit; die Antwort selbst ist kurz
    output_config: { effort: "low", format: zodOutputFormat(ERGEBNIS) }, // einfache Aufgabe: wenig nachdenken = günstig
    system: ANLEITUNG,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: medienTyp, data: daten } },
        { type: "text", text: "Was ist das für ein Stück?" },
      ],
    }],
  });

  console.log(`Erkannt: ${nachricht.usage.input_tokens} Token rein, ${nachricht.usage.output_tokens} Token raus, Grund: ${nachricht.stop_reason}`);
  if (nachricht.stop_reason === "refusal") return { fehler: "Claude möchte dieses Foto nicht beschreiben." };
  if (nachricht.stop_reason === "max_tokens" || !nachricht.parsed_output) return { fehler: "Claude konnte das Foto nicht auswerten." };
  return { ergebnis: nachricht.parsed_output };
}

// ---------- Der Server ----------
const server = http.createServer(async (anfrage, antwort) => {
  const herkunft = anfrage.headers.origin || "";
  const pfad = new URL(anfrage.url, "http://x").pathname;

  if (anfrage.method === "GET" && pfad === "/") return antworte(antwort, herkunft, 200, { ok: true, dienst: "Mon Dressing" });
  if (anfrage.method === "OPTIONS") return antworte(antwort, herkunft, 204); // Vorab-Frage des Browsers
  if (anfrage.method !== "POST" || (pfad !== "/erkennen" && pfad !== "/pruefen")) return antworte(antwort, herkunft, 404, { fehler: "Gibt es nicht." });

  if (herkunft && !ERLAUBTE_HERKUNFT.includes(herkunft)) {
    console.log(`Abgelehnt: Anfrage von ${herkunft} (erlaubt ist nur ${ERLAUBTE_HERKUNFT.join(", ")})`);
    return antworte(antwort, herkunft, 403, { fehler: "Nicht erlaubt." });
  }
  if (!codeStimmt(anfrage.headers["x-zugangscode"])) {
    console.log("Abgelehnt: falscher Zugangscode"); // den Code selbst schreiben wir nie ins Protokoll
    return antworte(antwort, herkunft, 401, { fehler: "Der Zugangscode stimmt nicht." });
  }

  // Nur den Code prüfen (beim Einrichten in der App): kostet nichts und zählt nicht
  if (pfad === "/pruefen") {
    nochErlaubt(); // stellt den Zähler auf heute
    return antworte(antwort, herkunft, 200, { ok: true, uebrigHeute: TAGESLIMIT - zaehler.anzahl });
  }

  if (!nochErlaubt()) return antworte(antwort, herkunft, 429, { fehler: `Für heute sind alle ${TAGESLIMIT} Erkennungen verbraucht. Morgen geht es wieder.` });

  try {
    const { bild } = JSON.parse(await leseKoerper(anfrage));
    const treffer = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(bild || "");
    if (!treffer) return antworte(antwort, herkunft, 400, { fehler: "Das ist kein Foto." });

    zaehler.anzahl++; // zählt auch, wenn Claude danach scheitert: Kosten können trotzdem entstehen
    const { ergebnis, fehler } = await erkenne(treffer[1], treffer[2]);
    if (fehler) return antworte(antwort, herkunft, 502, { fehler });
    return antworte(antwort, herkunft, 200, { ...ergebnis, uebrigHeute: TAGESLIMIT - zaehler.anzahl });
  } catch (fehler) {
    if (fehler.status === 413) return antworte(antwort, herkunft, 413, { fehler: "Das Foto ist zu groß." });
    if (fehler instanceof SyntaxError) return antworte(antwort, herkunft, 400, { fehler: "Die Anfrage ist kaputt." });
    if (fehler instanceof Anthropic.RateLimitError) return antworte(antwort, herkunft, 503, { fehler: "Claude ist gerade überlastet. Versuch es gleich noch einmal." });
    if (fehler instanceof Anthropic.APIError) {
      console.error(`Claude-Fehler ${fehler.status}`); // ohne Details: dort könnte Privates stehen
      return antworte(antwort, herkunft, 502, { fehler: "Claude ist gerade nicht erreichbar." });
    }
    console.error("Unerwarteter Fehler:", fehler.message);
    return antworte(antwort, herkunft, 500, { fehler: "Da ist etwas schiefgegangen." });
  }
});

server.listen(PORT, () => console.log(`Mon Dressing Server läuft auf Port ${PORT} (Modell ${MODELL}, Tageslimit ${TAGESLIMIT}, erlaubte App: ${ERLAUBTE_HERKUNFT.join(", ")})`));
