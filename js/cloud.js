// cloud.js – deine Garderobe auf all deinen Geräten
//
// So funktioniert der Abgleich mit dem Server:
//   1. Holen: Was haben die anderen Geräte seit dem letzten Mal geändert? Neueres wird übernommen.
//   2. Hochladen: Was hier geändert wurde (speicher.js merkt es sich in der Schublade „ausstehend“).
// Gibt es dasselbe Stück auf zwei Geräten verschieden, gewinnt die neueste Änderung.
// Ohne Internet passiert nichts Schlimmes: Die App funktioniert wie immer und gleicht später ab.
//
// Die App fragt an diesen Stellen: beim Start, nach jeder Änderung, wenn das Internet
// zurückkommt und wenn man die App wieder öffnet. Und mit dem Knopf „Jetzt abgleichen“.

import {
  alleAusstehend, allesVormerken, ausstehendErledigt, cloudEintragLaden, lokaleZeit,
  ausCloudUebernehmen, spaeter, zeitVon, einstellungLesen, einstellungSpeichern,
} from "./speicher.js";
import { frageServer } from "./verbindung.js";
import { sitzung, anmeldeKopf, sitzungVergessen } from "./konto.js";
import { alsText, alsBild } from "./fotos.js";

const WARTEN_NACH_AENDERUNG_MS = 2000; // kurz warten, falls gleich noch mehr geändert wird

let laeuft = null;     // der Abgleich, der gerade läuft (es gibt immer nur einen)
let nochmal = false;   // während des Abgleichs kam eine neue Änderung dazu
let wecker = null;
const zustand = { laeuft: false, zuletzt: null, fehler: null };

// Für die Anzeige in der Garderobe: { laeuft, zuletzt, fehler }
export function cloudZustand() {
  return { ...zustand };
}

export function abgleichen() {
  if (laeuft) {
    nochmal = true;
    return laeuft;
  }
  laeuft = (async () => {
    melde({ laeuft: true });
    try {
      do {
        nochmal = false;
        await einmalAbgleichen();
      } while (nochmal);
      melde({ laeuft: false, zuletzt: new Date().toISOString(), fehler: null });
    } catch (fehler) {
      if (fehler.status === 401) {
        await sitzungVergessen(); // der Server kennt diese Anmeldung nicht mehr
        window.dispatchEvent(new Event("anmeldung-geaendert"));
      }
      melde({ laeuft: false, fehler: fehler.message });
    } finally {
      laeuft = null;
    }
  })();
  return laeuft;
}

async function einmalAbgleichen() {
  if (!(await sitzung())) return;
  const kopf = await anmeldeKopf();
  let konto = await einstellungLesen("cloudKonto");
  let stand = (await einstellungLesen("cloudStand")) || 0;
  let hierGeaendert = false;

  // 1. Holen, was die anderen Geräte geändert haben
  for (;;) {
    const antwort = await frageServer(`/cloud/aenderungen?seit=${stand}`, { methode: "GET", kopf });
    if (antwort.konto !== konto) {
      // Zum ersten Mal mit diesem Konto auf diesem Gerät: alles, was hier ist, kommt in die Cloud
      await allesVormerken();
      konto = antwort.konto;
      stand = 0;
      await einstellungSpeichern("cloudKonto", konto);
      await einstellungSpeichern("cloudStand", stand);
      continue;
    }
    for (const eintrag of antwort.eintraege) {
      if (await uebernehmen(eintrag, kopf)) hierGeaendert = true;
    }
    stand = antwort.stand;
    await einstellungSpeichern("cloudStand", stand);
    if (!antwort.mehr) break;
  }
  if (hierGeaendert) window.dispatchEvent(new Event("cloud-geaendert"));

  // 2. Hochladen, was hier geändert wurde
  for (const vermerk of await alleAusstehend()) {
    let hochgeladen;
    try {
      hochgeladen = await hochladen(vermerk, kopf);
    } catch (fehler) {
      // Lehnt der Server genau dieses eine Stück ab (kaputt oder zu groß), soll es die anderen nicht aufhalten
      if (fehler.status !== 400 && fehler.status !== 413) throw fehler;
      console.warn(`Nicht in die Cloud: ${vermerk.schluessel}:`, fehler.message);
      hochgeladen = vermerk.geaendertAm;
    }
    if (hochgeladen) await ausstehendErledigt(vermerk.schluessel, hochgeladen);
  }
}

// Eine Änderung von einem anderen Gerät übernehmen. Ergebnis: true, wenn sich hier etwas geändert hat
async function uebernehmen(eintrag, kopf) {
  const { art, id, geaendertAm, geloescht, daten } = eintrag;
  if (art !== "teil" && art !== "getragen") return false; // kennt diese App-Version noch nicht
  const hier = await lokaleZeit(art, id);
  if (spaeter(hier, geaendertAm)) return false; // hier ist es neuer

  let datensatz = null;
  if (!geloescht) {
    datensatz = { ...daten, id, geaendertAm };
    // Fotos nur holen, wenn sich wirklich etwas geändert hat
    if (art === "teil" && spaeter(geaendertAm, hier)) {
      const fotos = await frageServer(`/cloud/fotos?id=${encodeURIComponent(id)}`, { methode: "GET", kopf });
      datensatz.foto = alsBild(fotos.foto);
      datensatz.vorschau = alsBild(fotos.vorschau);
    }
  }
  return ausCloudUebernehmen(art, id, geaendertAm, datensatz);
}

// Eine Änderung von hier hochladen. Ergebnis: die Zeit der hochgeladenen Änderung (oder null)
async function hochladen(vermerk, kopf) {
  const { art, id, geloescht } = vermerk;
  if (geloescht) {
    await frageServer("/cloud/speichern", { inhalt: { art, id, geaendertAm: vermerk.geaendertAm, geloescht: true }, kopf });
    return vermerk.geaendertAm;
  }
  const eintrag = await cloudEintragLaden(art, id);
  if (!eintrag) return null; // inzwischen gelöscht: Dafür gibt es einen eigenen Vermerk
  const geaendertAm = zeitVon(eintrag);
  const inhalt = { art, id, geaendertAm };
  if (art === "teil") {
    const { foto, vorschau, ...angaben } = eintrag;
    if (!(foto instanceof Blob && vorschau instanceof Blob)) return geaendertAm; // ohne Foto geht es nicht in die Cloud
    inhalt.daten = angaben;
    inhalt.foto = await alsText(foto);
    inhalt.vorschau = await alsText(vorschau);
  } else {
    inhalt.daten = eintrag;
  }
  await frageServer("/cloud/speichern", { inhalt, kopf });
  return geaendertAm;
}

function melde(neu) {
  Object.assign(zustand, neu);
  window.dispatchEvent(new Event("cloud-zustand"));
}

// Etwas leise im Hintergrund abgleichen (Fehler stehen dann in cloudZustand)
function imHintergrund() {
  abgleichen().catch(() => {});
}

// Nach einer Änderung hier: kurz warten, dann abgleichen
window.addEventListener("lokal-geaendert", () => {
  clearTimeout(wecker);
  wecker = setTimeout(imHintergrund, WARTEN_NACH_AENDERUNG_MS);
});
// Internet ist wieder da, oder die App wird wieder geöffnet
window.addEventListener("online", imHintergrund);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") imHintergrund();
});
