// ki.js – Kleidung automatisch erkennen lassen
// Die App schickt das kleine Vorschaubild an unseren Server (Ordner server/, läuft bei Railway).
// Der Server fragt Claude und schickt Kategorie, Farbe, Wärme, regenfest und einen Namen zurück.
// Der API-Schlüssel liegt nur auf dem Server. Die App kennt nur den Zugangscode,
// den man einmal unten in der Garderobe eintippt (er wird auf dem Gerät gespeichert).

import { einstellungLesen, einstellungSpeichern } from "./speicher.js";

// Adresse des Servers bei Railway. Leer = die KI-Erkennung ist noch nicht eingerichtet
// (dann zeigt die App nichts davon an).
export const KI_ADRESSE = "";

const WARTEN_MS = 30 * 1000; // so lange warten wir höchstens auf eine Antwort

export function kiVorhanden() {
  return Boolean(KI_ADRESSE);
}

export function zugangscode() {
  return einstellungLesen("kiZugangscode");
}

export function zugangscodeSpeichern(code) {
  return einstellungSpeichern("kiZugangscode", code);
}

// Prüft einen Code beim Server (kostet nichts). Ergebnis: { ok, uebrigHeute } oder ein Fehler mit Text
export async function codePruefen(code) {
  return frageServer("/pruefen", code, {});
}

// Erkennt ein Stück auf dem Foto. Ergebnis:
// { istKleidung, kategorie, art, farbe, waerme, regenfest, name, uebrigHeute }
export async function erkenne(vorschau) {
  const code = await zugangscode();
  if (!code) throw new Error("Richte zuerst unten in der Garderobe die KI-Erkennung ein.");
  return frageServer("/erkennen", code, { bild: await alsText(vorschau) });
}

async function frageServer(pfad, code, inhalt) {
  const abbruch = new AbortController();
  const wecker = setTimeout(() => abbruch.abort(), WARTEN_MS);
  let antwort;
  try {
    antwort = await fetch(KI_ADRESSE.replace(/\/$/, "") + pfad, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Zugangscode": code },
      body: JSON.stringify(inhalt),
      signal: abbruch.signal,
    });
  } catch {
    throw new Error(abbruch.signal.aborted
      ? "Der Server hat zu lange gebraucht. Versuch es gleich noch einmal."
      : "Keine Verbindung zum Server. Hast du Internet?");
  } finally {
    clearTimeout(wecker);
  }
  const daten = await antwort.json().catch(() => ({}));
  if (!antwort.ok) {
    throw new Error(antwort.status === 401
      ? "Der Zugangscode stimmt nicht. Prüf ihn unten in der Garderobe."
      : daten.fehler || "Die Erkennung hat nicht geklappt.");
  }
  return daten;
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
