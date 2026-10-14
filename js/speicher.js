// speicher.js – alles rund ums Speichern
// Die App speichert in IndexedDB, einer kleinen Datenbank im Browser des Geräts.
// Alle anderen Dateien benutzen NUR die Funktionen aus dieser Datei.
// Wenn später eine Cloud dazukommt, ändern wir nur diese Datei.
//
// So sieht ein gespeichertes Kleidungsstück ("Teil") aus:
// {
//   id: "3f2a…",                 eindeutige Nummer
//   name: "Gelbe Regenjacke",
//   kategorie: "jacke",           siehe daten.js
//   waerme: "warm",
//   regenfest: true,
//   farbe: "gelb",
//   art: "tasche",                nur bei Accessoires (siehe daten.js), sonst null
//   anlaesse: ["schule", "alltag"],
//   foto: (Bild, höchstens 1280 Pixel),
//   vorschau: (kleines Bild für den Kleiderschrank),
//   erstelltAm: "2026-10-13T12:00:00.000Z",
//   geaendertAm: "2026-10-13T12:00:00.000Z"
// }

const DATENBANK_NAME = "outfit-assistent";
const DATENBANK_VERSION = 1;

let datenbank = null; // wird beim ersten Zugriff geöffnet

function oeffneDatenbank() {
  if (!datenbank) {
    datenbank = new Promise((fertig, fehler) => {
      const anfrage = indexedDB.open(DATENBANK_NAME, DATENBANK_VERSION);

      // Nur beim allerersten Öffnen: die "Schubladen" anlegen
      anfrage.onupgradeneeded = () => {
        const db = anfrage.result;
        db.createObjectStore("teile", { keyPath: "id" });     // Kleidungsstücke
        db.createObjectStore("getragen", { keyPath: "id" });  // „Heute getragen“ (ab 1.2)
        db.createObjectStore("einstellungen");                // z. B. Stadt (ab 1.3)
      };
      anfrage.onsuccess = () => fertig(anfrage.result);
      anfrage.onerror = () => fehler(anfrage.error);
    });
  }
  return datenbank;
}

// Hilfsfunktion: eine Schublade öffnen, etwas darin tun, auf das Ergebnis warten
async function inSchublade(name, modus, arbeit) {
  const db = await oeffneDatenbank();
  return new Promise((fertig, fehler) => {
    const vorgang = db.transaction(name, modus);
    const anfrage = arbeit(vorgang.objectStore(name));
    vorgang.oncomplete = () => fertig(anfrage.result);
    vorgang.onerror = () => fehler(vorgang.error);
    vorgang.onabort = () => fehler(vorgang.error);
  });
}

// ---------- Kleidungsstücke ----------
export function alleTeile() {
  return inSchublade("teile", "readonly", (schublade) => schublade.getAll());
}

export function teilLaden(id) {
  return inSchublade("teile", "readonly", (schublade) => schublade.get(id));
}

export function teilSpeichern(teil) {
  return inSchublade("teile", "readwrite", (schublade) => schublade.put(teil));
}

export function teilLoeschen(id) {
  return inSchublade("teile", "readwrite", (schublade) => schublade.delete(id));
}

// ---------- „Heute getragen“ ----------
// Pro Tag ein Eintrag. Die Nummer (id) ist das Datum, z. B. "2026-10-13":
// {
//   id: "2026-10-13", datum: "2026-10-13",
//   teile: ["3f2a…", "9b1c…"],   die Nummern der getragenen Teile
//   wetter: { tempMax: 15, tempMin: 8, regen: false, regenMm: 0.4, regenProzent: 45, ort: "Berlin" }
//           (oder null, wenn das Wetter nicht geholt werden konnte)
// }
export function alleGetragen() {
  return inSchublade("getragen", "readonly", (schublade) => schublade.getAll());
}

export function getragenLaden(id) {
  return inSchublade("getragen", "readonly", (schublade) => schublade.get(id));
}

export function getragenSpeichern(eintrag) {
  return inSchublade("getragen", "readwrite", (schublade) => schublade.put(eintrag));
}

export function getragenLoeschen(id) {
  return inSchublade("getragen", "readwrite", (schublade) => schublade.delete(id));
}

// ---------- Einstellungen (z. B. der Ort fürs Wetter) ----------
export function einstellungLesen(schluessel) {
  return inSchublade("einstellungen", "readonly", (schublade) => schublade.get(schluessel));
}

export function einstellungSpeichern(schluessel, wert) {
  return inSchublade("einstellungen", "readwrite", (schublade) => schublade.put(wert, schluessel));
}

// ---------- Hilfen ----------

// Eine neue, eindeutige Nummer für ein Teil
export function neueId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// Den Browser bitten, unsere Daten nicht von selbst zu löschen (z. B. wenn der Speicher knapp wird).
// Das ist eine Bitte, keine Garantie. Deshalb kommt später noch die Sicherung (1.4).
export async function bitteUmDauerhaftenSpeicher() {
  try {
    if (navigator.storage && navigator.storage.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch {
    // Nicht schlimm: Dann bleibt es beim normalen Speicher.
  }
}
