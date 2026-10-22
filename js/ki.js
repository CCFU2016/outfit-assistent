// ki.js – Kleidung automatisch erkennen lassen
// Die App schickt das kleine Vorschaubild an unseren Server (Ordner server/, läuft bei Railway).
// Der Server fragt Claude und schickt Kategorie, Farbe, Wärme, regenfest und einen Namen zurück.
// Der API-Schlüssel liegt nur auf dem Server. Die App weist sich aus:
//   - angemeldet: mit dem Anmelde-Schlüssel (siehe konto.js)
//   - sonst (Übergang): mit dem Zugangscode, den man einmal unten in der Garderobe eintippt

import { einstellungLesen, einstellungSpeichern } from "./speicher.js";
import { SERVER_ADRESSE, frageServer } from "./verbindung.js";
import { sitzung, anmeldeKopf, sitzungVergessen } from "./konto.js";

// Gibt es überhaupt einen Server? (Sonst zeigt die App nichts von der KI-Erkennung an.)
export function kiVorhanden() {
  return Boolean(SERVER_ADRESSE);
}

export function zugangscode() {
  return einstellungLesen("kiZugangscode");
}

export function zugangscodeSpeichern(code) {
  return einstellungSpeichern("kiZugangscode", code);
}

// Kann die App gerade erkennen lassen? (angemeldet oder Zugangscode eingetragen)
export async function kiBereit() {
  return kiVorhanden() && Boolean((await sitzung()) || (await zugangscode()));
}

// Prüft einen Code beim Server (kostet nichts). Ergebnis: { ok, uebrigHeute } oder ein Fehler mit Text
export async function codePruefen(code) {
  return frageServer("/pruefen", { inhalt: {}, kopf: { "X-Zugangscode": code } });
}

// Erkennt ein Stück auf dem Foto. Ergebnis:
// { istKleidung, kategorie, art, farbe, waerme, regenfest, name, uebrigHeute }
export async function erkenne(vorschau) {
  const angemeldet = Boolean(await sitzung());
  const code = await zugangscode();
  if (!angemeldet && !code) throw new Error("Richte zuerst unten in der Garderobe die KI-Erkennung ein.");
  const kopf = angemeldet ? await anmeldeKopf() : { "X-Zugangscode": code };
  try {
    return await frageServer("/erkennen", { inhalt: { bild: await alsText(vorschau) }, kopf });
  } catch (fehler) {
    if (fehler.status !== 401) throw fehler;
    if (angemeldet) {
      await sitzungVergessen(); // der Server kennt diese Anmeldung nicht mehr
      throw new Error("Bitte melde dich neu an.");
    }
    throw new Error("Der Zugangscode stimmt nicht. Prüf ihn unten in der Garderobe.");
  }
}

// Foto (Blob) → Text "data:image/jpeg;base64,…"
function alsText(bild) {
  return new Promise((fertig, fehler) => {
    const leser = new FileReader();
    leser.onload = () => fertig(leser.result);
    leser.onerror = () => fehler(leser.error);
    leser.readAsDataURL(bild);
  });
}
