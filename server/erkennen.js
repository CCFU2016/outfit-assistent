// erkennen.js – Claude fragt: Was ist das für ein Kleidungsstück?
// Das Modell steht hier fest (Sonnet). Die App kann es nicht ändern.

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import * as z from "zod/v4";

export const MODELL = "claude-sonnet-5-5"; // fest: nicht teurer als Sonnet

// Erst beim ersten Foto erzeugen (dann ist sicher, dass die Variable geprüft wurde)
let claude = null;
function client() {
  claude ??= new Anthropic({ apiKey: process.env.CLAUDE_API_SCHLUESSEL });
  return claude;
}

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

// ---------- Claude fragen ----------
export async function erkenne(medienTyp, daten) {
  const nachricht = await client().messages.parse({
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
