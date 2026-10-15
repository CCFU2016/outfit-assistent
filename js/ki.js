// ki.js – Kleidung automatisch erkennen lassen
// Die App schickt das kleine Vorschaubild an unseren Server (Ordner server/, läuft bei Railway).
// Der Server fragt Claude und schickt Kategorie, Farbe, Wärme, regenfest und einen Namen zurück.
// Der API-Schlüssel liegt nur auf dem Server. Die App kennt nur den Zugangscode,
// den man einmal unten in der Garderobe eintippt (er wird auf dem Gerät gespeichert).

import { einstellungLesen, einstellungSpeichern } from "./speicher.js";

// Adresse des Servers bei Railway. Leer = die KI-Erkennung ist noch nicht eingerichtet
// (dann zeigt die App nichts davon an).
export const KI_ADRESSE = "https://outfit-assistent-production.up.railway.app";

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
    // Der Browser verrät nicht genau, warum es nicht geklappt hat. Ob das Gerät online ist, wissen wir aber.
    if (abbruch.signal.aborted) throw new Error("Der Server hat zu lange gebraucht. Versuch es gleich noch einmal.");
    if (navigator.onLine === false) throw new Error("Du bist gerade offline. Für die Erkennung brauchst du Internet.");
    throw new Error("Der Server für die Erkennung antwortet nicht. An deinem Internet liegt es wahrscheinlich nicht. Sag bitte einem Erwachsenen Bescheid.");
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
