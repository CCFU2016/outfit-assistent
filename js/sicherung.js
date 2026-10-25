// sicherung.js – alle Stücke, Fotos und Looks in einer Datei sichern und wieder laden
//
// Die Datei ist eine Textdatei im JSON-Format. Die Fotos stehen als Text darin
// ("data:image/jpeg;base64,…"), damit alles in EINER Datei steckt.
//
// iPhone:  „Sicherung speichern“ öffnet das Teilen-Menü → „In Dateien sichern“.
// Android: Die Datei landet im Ordner „Downloads“.

import {
  alleTeile, alleGetragen, einstellungLesen, einstellungSpeichern, sicherungEinspielen,
} from "./speicher.js";
import { alsText, alsBild } from "./fotos.js";

const APP_KENNUNG = "mon-dressing";  // so erkennt die App ihre eigenen Sicherungen
const FORMAT = 1;                    // falls sich der Aufbau der Datei später ändert

// ---------- Sicherung speichern ----------
// Ergebnis: { anzahlTeile, anzahlLooks, geteilt } oder null, wenn man im Teilen-Menü abgebrochen hat
export async function sicherungSpeichern() {
  const [teile, getragen, ort] = await Promise.all([alleTeile(), alleGetragen(), einstellungLesen("ort")]);

  const inhalt = {
    app: APP_KENNUNG,
    format: FORMAT,
    erstelltAm: new Date().toISOString(),
    teile: await Promise.all(teile.map(async (teil) => ({
      ...teil,
      foto: await alsText(teil.foto),
      vorschau: await alsText(teil.vorschau),
    }))),
    getragen,
    einstellungen: ort ? { ort } : {},
  };

  const dateiname = `mon-dressing-sicherung-${heute()}.json`;
  const datei = new File([JSON.stringify(inhalt)], dateiname, { type: "application/json" });

  // iPhone (und manche andere Geräte): das Teilen-Menü öffnen
  let geteilt = false;
  if (navigator.canShare && navigator.canShare({ files: [datei] })) {
    try {
      await navigator.share({ files: [datei], title: "Mon Dressing – Sicherung" });
      geteilt = true;
    } catch (fehler) {
      if (fehler.name === "AbortError") return null; // im Teilen-Menü auf „Abbrechen“ getippt
      throw fehler;
    }
  } else {
    // Android und Computer: ganz normal herunterladen
    const adresse = URL.createObjectURL(datei);
    const link = document.createElement("a");
    link.href = adresse;
    link.download = dateiname;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(adresse), 60 * 1000);
  }

  await einstellungSpeichern("letzteSicherung", inhalt.erstelltAm);
  return { anzahlTeile: teile.length, anzahlLooks: getragen.length, geteilt };
}

// ---------- Sicherung laden ----------
// Schritt 1: die Datei lesen und prüfen. Ergebnis: eine Übersicht zum Nachfragen.
// Wirft einen Fehler mit freundlichem Text, wenn die Datei nicht passt.
export async function sicherungLesen(datei) {
  let inhalt;
  try {
    inhalt = JSON.parse(await datei.text());
  } catch {
    throw new Error("Das ist keine Sicherung von Mon Dressing. Wähl die Datei, die mit „mon-dressing-sicherung“ anfängt.");
  }
  if (!inhalt || inhalt.app !== APP_KENNUNG || !Array.isArray(inhalt.teile)) {
    throw new Error("Das ist keine Sicherung von Mon Dressing. Wähl die Datei, die mit „mon-dressing-sicherung“ anfängt.");
  }
  if (inhalt.format > FORMAT) {
    throw new Error("Diese Sicherung ist von einer neueren Version der App. Öffne die App einmal neu, dann klappt es.");
  }

  // Nur vollständige Stücke übernehmen (mit Nummer, Name, Kategorie und Foto)
  const teile = [];
  let kaputt = 0;
  for (const teil of inhalt.teile) {
    try {
      if (!teil.id || !teil.name || !teil.kategorie || !teil.foto) throw new Error("unvollständig");
      teile.push({ ...teil, foto: alsBild(teil.foto), vorschau: alsBild(teil.vorschau || teil.foto) });
    } catch {
      kaputt++;
    }
  }
  const getragen = (Array.isArray(inhalt.getragen) ? inhalt.getragen : [])
    .filter((eintrag) => eintrag && eintrag.id && eintrag.datum && Array.isArray(eintrag.teile));

  return { teile, getragen, ort: inhalt.einstellungen?.ort || null, erstelltAm: inhalt.erstelltAm, kaputt };
}

// Schritt 2: wirklich einspielen (nach dem Nachfragen)
export async function sicherungLaden({ teile, getragen, ort }) {
  // Den Ort nur übernehmen, wenn auf diesem Gerät noch keiner festgelegt ist
  const einstellungen = {};
  if (ort && !(await einstellungLesen("ort"))) einstellungen.ort = ort;
  await sicherungEinspielen({ teile, getragen, einstellungen });
}

export function letzteSicherung() {
  return einstellungLesen("letzteSicherung");
}

// ---------- Hilfen ----------
// Heutiges Datum als "2026-10-15" (für den Dateinamen)
function heute() {
  const jetzt = new Date();
  return `${jetzt.getFullYear()}-${String(jetzt.getMonth() + 1).padStart(2, "0")}-${String(jetzt.getDate()).padStart(2, "0")}`;
}
