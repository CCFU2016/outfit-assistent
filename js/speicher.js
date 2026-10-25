// speicher.js – alles rund ums Speichern
// Die App speichert in IndexedDB, einer kleinen Datenbank im Browser des Geräts.
// Alle anderen Dateien benutzen NUR die Funktionen aus dieser Datei.
// Für die Cloud merkt sich diese Datei jede Änderung in der Schublade „ausstehend“.
// cloud.js lädt sie dann hoch, sobald es Internet gibt.
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
const DATENBANK_VERSION = 2; // 2: Schublade „ausstehend“ für die Cloud

let datenbank = null; // wird beim ersten Zugriff geöffnet

function oeffneDatenbank() {
  if (!datenbank) {
    datenbank = new Promise((fertig, fehler) => {
      const anfrage = indexedDB.open(DATENBANK_NAME, DATENBANK_VERSION);

      // Nur wenn die Datenbank neu ist oder älter als diese App: fehlende "Schubladen" anlegen
      anfrage.onupgradeneeded = (ereignis) => {
        const db = anfrage.result;
        if (ereignis.oldVersion < 1) {
          db.createObjectStore("teile", { keyPath: "id" });     // Kleidungsstücke
          db.createObjectStore("getragen", { keyPath: "id" });  // „Heute getragen“ (ab 1.2)
          db.createObjectStore("einstellungen");                // z. B. Stadt (ab 1.3)
        }
        if (ereignis.oldVersion < 2) {
          db.createObjectStore("ausstehend", { keyPath: "schluessel" }); // Änderungen, die noch in die Cloud müssen
        }
      };
      anfrage.onsuccess = () => {
        const db = anfrage.result;
        db.onversionchange = () => db.close(); // eine neuere App-Version will die Datenbank umbauen: Platz machen
        fertig(db);
      };
      anfrage.onerror = () => fehler(anfrage.error);
    });
  }
  return datenbank;
}

// Mehrere Schubladen in EINEM Vorgang beschreiben: Entweder klappt alles oder nichts
async function schreiben(namen, arbeit) {
  const db = await oeffneDatenbank();
  return new Promise((fertig, fehler) => {
    const vorgang = db.transaction(namen, "readwrite");
    arbeit(vorgang);
    vorgang.oncomplete = () => fertig();
    vorgang.onerror = () => fehler(vorgang.error);
    vorgang.onabort = () => fehler(vorgang.error);
  });
}

// Für die Cloud vormerken: „Dieses Stück (oder dieser Tag) hat sich hier geändert“
function vormerken(vorgang, art, id, geaendertAm, geloescht = false) {
  vorgang.objectStore("ausstehend").put({ schluessel: `${art}:${id}`, art, id, geaendertAm, geloescht });
}

// Sagt cloud.js Bescheid, dass es etwas hochzuladen gibt
function lokalGeaendert() {
  window.dispatchEvent(new Event("lokal-geaendert"));
}

// Wann wurde ein Stück oder ein Tag zuletzt geändert? (Ältere Einträge haben noch keine Zeit.)
export function zeitVon(eintrag) {
  return eintrag.geaendertAm || eintrag.gespeichertAm || eintrag.erstelltAm || "1970-01-01T00:00:00.000Z";
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

export async function teilSpeichern(teil) {
  await schreiben(["teile", "ausstehend"], (vorgang) => {
    vorgang.objectStore("teile").put(teil);
    vormerken(vorgang, "teil", teil.id, zeitVon(teil));
  });
  lokalGeaendert();
}

export async function teilLoeschen(id) {
  await schreiben(["teile", "ausstehend"], (vorgang) => {
    vorgang.objectStore("teile").delete(id);
    vormerken(vorgang, "teil", id, new Date().toISOString(), true);
  });
  lokalGeaendert();
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

export async function getragenSpeichern(eintrag) {
  const mitZeit = { ...eintrag, geaendertAm: new Date().toISOString() };
  await schreiben(["getragen", "ausstehend"], (vorgang) => {
    vorgang.objectStore("getragen").put(mitZeit);
    vormerken(vorgang, "getragen", mitZeit.id, mitZeit.geaendertAm);
  });
  lokalGeaendert();
}

export async function getragenLoeschen(id) {
  await schreiben(["getragen", "ausstehend"], (vorgang) => {
    vorgang.objectStore("getragen").delete(id);
    vormerken(vorgang, "getragen", id, new Date().toISOString(), true);
  });
  lokalGeaendert();
}

// ---------- Einstellungen (z. B. der Ort fürs Wetter) ----------
export function einstellungLesen(schluessel) {
  return inSchublade("einstellungen", "readonly", (schublade) => schublade.get(schluessel));
}

export function einstellungSpeichern(schluessel, wert) {
  return inSchublade("einstellungen", "readwrite", (schublade) => schublade.put(wert, schluessel));
}

// ---------- Sicherung laden (1.4) ----------
// Schreibt viele Stücke, Looks und Einstellungen auf einmal.
// Alles passiert in EINEM Vorgang: Klappt etwas nicht, wird gar nichts geändert.
// Es wird nichts gelöscht: Gleiche Nummern werden ersetzt, alles andere bleibt.
// Alles Geladene kommt auch in die Cloud (dort gewinnt wie immer die neueste Änderung).
export async function sicherungEinspielen({ teile, getragen, einstellungen }) {
  await schreiben(["teile", "getragen", "einstellungen", "ausstehend"], (vorgang) => {
    for (const teil of teile) {
      vorgang.objectStore("teile").put(teil);
      vormerken(vorgang, "teil", teil.id, zeitVon(teil));
    }
    for (const eintrag of getragen) {
      vorgang.objectStore("getragen").put(eintrag);
      vormerken(vorgang, "getragen", eintrag.id, zeitVon(eintrag));
    }
    for (const [schluessel, wert] of Object.entries(einstellungen)) {
      vorgang.objectStore("einstellungen").put(wert, schluessel);
    }
  });
  lokalGeaendert();
}

// ---------- Für die Cloud (die Arbeit macht cloud.js) ----------
const SCHUBLADE_VON = { teil: "teile", getragen: "getragen" };

// Alle Änderungen, die noch hochgeladen werden müssen
export function alleAusstehend() {
  return inSchublade("ausstehend", "readonly", (schublade) => schublade.getAll());
}

// Beim ersten Abgleich mit einem Konto: alles, was auf diesem Gerät ist, für die Cloud vormerken
export async function allesVormerken() {
  const [teile, getragen] = await Promise.all([alleTeile(), alleGetragen()]);
  await schreiben(["ausstehend"], (vorgang) => {
    for (const teil of teile) vormerken(vorgang, "teil", teil.id, zeitVon(teil));
    for (const eintrag of getragen) vormerken(vorgang, "getragen", eintrag.id, zeitVon(eintrag));
  });
}

// Hochgeladen: den Vermerk löschen. Aber nur, wenn es inzwischen keine neuere Änderung gab.
export function ausstehendErledigt(schluessel, geaendertAm) {
  return schreiben(["ausstehend"], (vorgang) => {
    const schublade = vorgang.objectStore("ausstehend");
    const vermerk = schublade.get(schluessel);
    vermerk.onsuccess = () => {
      if (vermerk.result && !spaeter(vermerk.result.geaendertAm, geaendertAm)) schublade.delete(schluessel);
    };
  });
}

// Ein Stück oder einen Tag so laden, wie es auf diesem Gerät ist (oder undefined)
export function cloudEintragLaden(art, id) {
  return inSchublade(SCHUBLADE_VON[art], "readonly", (schublade) => schublade.get(id));
}

// Wann hat sich das hier zuletzt geändert? Auch gelöschte Dinge haben eine Zeit (im Vermerk). "" = nie
export async function lokaleZeit(art, id) {
  const eintrag = await cloudEintragLaden(art, id);
  if (eintrag) return zeitVon(eintrag);
  const vermerk = await inSchublade("ausstehend", "readonly", (schublade) => schublade.get(`${art}:${id}`));
  return vermerk ? vermerk.geaendertAm : "";
}

// Eine Änderung von einem anderen Gerät übernehmen, aber nur, wenn sie nicht älter ist als das hier.
// datensatz = null heißt: auf dem anderen Gerät gelöscht. Ergebnis: true, wenn sich hier etwas geändert hat.
export async function ausCloudUebernehmen(art, id, geaendertAm, datensatz) {
  let geaendert = false;
  await schreiben([SCHUBLADE_VON[art], "ausstehend"], (vorgang) => {
    const schublade = vorgang.objectStore(SCHUBLADE_VON[art]);
    const vermerke = vorgang.objectStore("ausstehend");
    const lokal = schublade.get(id);
    const vermerk = vermerke.get(`${art}:${id}`);
    vermerk.onsuccess = () => { // die Anfragen kommen der Reihe nach zurück: „lokal“ ist schon da
      const hier = lokal.result ? zeitVon(lokal.result) : vermerk.result?.geaendertAm || "";
      if (spaeter(hier, geaendertAm)) return; // hier ist es neuer: bleibt so und wird hochgeladen
      if (vermerk.result) vermerke.delete(`${art}:${id}`); // die Cloud hat schon denselben oder einen neueren Stand
      if (!spaeter(geaendertAm, hier)) return; // genau gleich alt: nichts zu tun
      if (datensatz) schublade.put(datensatz);
      else if (lokal.result) schublade.delete(id);
      geaendert = Boolean(datensatz || lokal.result);
    };
  });
  return geaendert;
}

// Ist Zeit a später als Zeit b? ("" heißt: gibt es nicht, also früher als alles)
export function spaeter(a, b) {
  return (a ? Date.parse(a) : -1) > (b ? Date.parse(b) : -1);
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
