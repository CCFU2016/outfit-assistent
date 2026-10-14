// vorschlag.js – sucht aus deinem Kleiderschrank Outfits, die zum Wetter passen
// Hier ist nur die Logik (kein Bildschirm). Gezeigt wird alles in wetter-seite.js.
//
// So wird ausgesucht – jedes Teil bekommt Punkte, das Teil mit den meisten gewinnt:
//   + Wärme passt zur Temperatur (leicht ab 20 °C, mittel 12–19 °C, warm unter 12 °C)
//   + regenfest, wenn es regnen soll (vor allem bei Jacke und Schuhen)
//   + passt zum gewählten Anlass (z. B. Schule)
//   + wurde schon bei ähnlichem Wetter getragen
//   − wurde am Tag davor schon vorgeschlagen oder kurz vorher getragen (für Abwechslung)
//   − regenfeste Schuhe (z. B. Gummistiefel), wenn es trocken bleibt
// Das Wetter zählt immer am meisten: Abwechslung gibt es nur zwischen Teilen, die gleich gut passen.
// Danach kommen die Farben: Die App probiert alle Kombinationen durch und nimmt lieber eine
// mit höchstens 3 Farben (MAX_FARBEN in kombi.js). Bei Kälte kommt etwas Warmes dazu, sonst eine passende Tasche.

import { KATEGORIEN, WAERME, ANLAESSE, FARBEN, OUTFIT_REIHENFOLGE, nameVon } from "./daten.js";
import { MAX_FARBEN, farbenVon, farbStrafe, istTasche, tascheGehtZu, passendeTaschen, kombiTipps, aufzaehlen } from "./kombi.js";

// Die Richtwerte aus dem Formular, bezogen auf die Höchsttemperatur des Tages
export function passendeWaerme(tempMax) {
  if (tempMax >= 20) return "leicht";
  if (tempMax >= 12) return "mittel";
  return "warm";
}

const STUFE = { leicht: 0, mittel: 1, warm: 2 };

// Ab wann ist Wetter "ähnlich"? Höchstens so viele Grad Unterschied und gleich bei Regen.
const AEHNLICH_GRAD = 4;

// Vorschläge für mehrere Tage, einer nach dem anderen.
//   teile:    alle Kleidungsstücke
//   tage:     das Wetter, z. B. aus wetterTage() (heute zuerst)
//   getragen: der Verlauf von „Heute getragen“
//   anlass:   z. B. "schule", oder null für egal
// Ergebnis: pro Tag { teile: [die gewählten Teile, von oben nach unten], gruende: [...], hinweise: [...] }
export function planeVorschlaege(teile, tage, getragen, anlass = null) {
  let tagDavor = new Set(); // die Teile, die für den Tag davor vorgeschlagen wurden

  return tage.map((tag) => {
    const kuerzlichGetragen = zuletztGetragen(getragen, tag.datum);
    const vorschlag = vorschlagFuerTag(teile, tag, getragen, anlass, tagDavor, kuerzlichGetragen);
    tagDavor = new Set(vorschlag.teile.map((teil) => teil.id));
    return vorschlag;
  });
}

function vorschlagFuerTag(teile, tag, getragen, anlass, tagDavor, kuerzlichGetragen) {
  const waerme = passendeWaerme(tag.tempMax);
  const gruende = [`${tag.tempMax} °C und ${tag.regen ? "Regen" : "trocken"}: dazu passen ${waermeWort(waerme)} Sachen.`];
  const hinweise = [];

  // Wie oft wurde ein Teil schon bei ähnlichem Wetter getragen?
  const aehnlich = new Map();
  for (const eintrag of getragen) {
    const w = eintrag.wetter;
    if (!w || Math.abs(w.tempMax - tag.tempMax) > AEHNLICH_GRAD || w.regen !== tag.regen) continue;
    for (const id of eintrag.teile) aehnlich.set(id, (aehnlich.get(id) || 0) + 1);
  }

  function punkte(teil) {
    let p = 0;
    const abstand = Math.abs((STUFE[teil.waerme] ?? 1) - STUFE[waerme]);
    p += abstand === 0 ? 4 : abstand === 1 ? 1 : -3;
    if (tag.regen && teil.regenfest) p += teil.kategorie === "jacke" || teil.kategorie === "schuhe" ? 3 : 1;
    if (!tag.regen && teil.regenfest && teil.kategorie === "schuhe") p -= 1.5;
    if (anlass) {
      const anlaesse = teil.anlaesse || [];
      if (anlaesse.includes(anlass)) p += 2;
      else if (anlaesse.length > 0) p -= 1; // passt zu anderen Anlässen, aber nicht zu diesem
    }
    p += Math.min(aehnlich.get(teil.id) || 0, 3) * 0.7;
    if (tagDavor.has(teil.id)) p -= 0.5;
    if (kuerzlichGetragen.has(teil.id)) p -= 0.5;
    return p;
  }

  // Das beste Teil einer Kategorie (bei Gleichstand nach Name, damit es nicht hin und her springt)
  function bestes(kategorie, nurWenn = () => true) {
    const kandidaten = teile.filter((teil) => teil.kategorie === kategorie && nurWenn(teil));
    if (kandidaten.length === 0) return null;
    return kandidaten
      .map((teil) => ({ teil, punkte: punkte(teil) }))
      .sort((a, b) => b.punkte - a.punkte || a.teil.name.localeCompare(b.teil.name))[0];
  }

  // Die besten Kandidaten einer Kategorie (höchstens 6, damit das Durchprobieren schnell bleibt)
  function kandidaten(kategorie, nurWenn = () => true) {
    return teile
      .filter((teil) => teil.kategorie === kategorie && nurWenn(teil))
      .map((teil) => ({ teil, punkte: punkte(teil) }))
      .sort((a, b) => b.punkte - a.punkte || a.teil.name.localeCompare(b.teil.name))
      .slice(0, 6);
  }

  // 1. Unten herum: Oberteil + Hose/Rock oder ein Kleid
  const oben = kandidaten("oberteil");
  const unten = kandidaten("hose-rock");
  const kleider = kandidaten("kleid");
  const grundlagen = [];
  for (const o of oben) for (const u of unten) grundlagen.push([o, u]);
  for (const k of kleider) grundlagen.push([k]);
  if (grundlagen.length === 0) {
    const fehlt = [!oben.length && "ein Oberteil", !unten.length && "eine Hose oder einen Rock"].filter(Boolean).join(" und ");
    return {
      teile: [],
      gruende,
      hinweise: [`Für einen Vorschlag brauche ich noch ${fehlt} (oder ein Kleid). Leg es in deiner Garderobe an!`],
    };
  }

  // 2. Jacke, wenn es kühl ist oder regnen soll, und Schuhe
  const jackeNoetig = waerme !== "leicht" || tag.regen;
  const jacken = jackeNoetig ? kandidaten("jacke") : [];
  const schuhe = kandidaten("schuhe");

  // 3. Alle Kombinationen durchprobieren. Gewinner: die meisten Punkte.
  //    Reihenfolge der Wichtigkeit: falsche Wärme kostet 3, jede Farbe zu viel 2,5 (siehe kombi.js),
  //    ein Teil vom Vortag 0,5. Also: Wetter vor Farben vor Abwechslung.
  let beste = null;
  for (const grundlage of grundlagen) {
    // Ein Kleid ersetzt Oberteil und Hose, zählt also doppelt.
    // Bei Gleichstand lieber Oberteil + Hose (darum der winzige Abzug).
    const grundPunkte = grundlage.length === 1 ? grundlage[0].punkte * 2 - 0.01 : grundlage[0].punkte + grundlage[1].punkte;
    for (const jacke of jacken.length ? jacken : [null]) {
      for (const schuh of schuhe.length ? schuhe : [null]) {
        const auswahl = [...grundlage, jacke, schuh].filter(Boolean);
        const summe = grundPunkte + (jacke ? jacke.punkte : 0) + (schuh ? schuh.punkte : 0);
        const imOutfit = auswahl.map(({ teil }) => teil);
        // Kleiner Bonus, wenn eine eigene Tasche farblich dazu passt
        const taschenBonus = anlass !== "sport" && passendeTaschen(imOutfit, teile).length ? 0.5 : 0;
        const wert = summe - farbStrafe(imOutfit) * 2.5 + taschenBonus;
        if (!beste || wert > beste.wert) beste = { auswahl, wert };
      }
    }
  }
  const gewaehlt = beste.auswahl;

  const jacke = gewaehlt.find(({ teil }) => teil.kategorie === "jacke");
  if (jackeNoetig && !jacke) {
    hinweise.push(tag.regen ? "Es soll regnen, aber du hast noch keine Jacke angelegt." : "Es ist kühl, aber du hast noch keine Jacke angelegt.");
  }
  if (jacke && tag.regen && jacke.teil.regenfest) gruende.push(`${jacke.teil.name}, weil sie regenfest ist.`);
  if (jacke && tag.regen && !jacke.teil.regenfest) {
    hinweise.push("Es soll regnen und du hast noch keine regenfeste Jacke. Nimm lieber einen Schirm mit! ☂️");
  }
  if (!schuhe.length) hinweise.push("Du hast noch keine Schuhe angelegt.");

  // 4. Accessoires: bei Kälte etwas Warmes (z. B. Mütze oder Schal), und eine passende Tasche
  const imOutfit = () => gewaehlt.map(({ teil }) => teil);
  if (waerme === "warm") {
    const warm = kandidaten("accessoire", (teil) => teil.waerme === "warm" && !istTasche(teil))
      .sort((a, b) => farbStrafe([...imOutfit(), a.teil]) - farbStrafe([...imOutfit(), b.teil]))[0];
    if (warm) gewaehlt.push(warm);
  }
  if (anlass !== "sport") {
    const tasche = kandidaten("accessoire", (teil) => istTasche(teil) && tascheGehtZu(teil, imOutfit()))[0];
    if (tasche) {
      gewaehlt.push(tasche);
      gruende.push(`Die Tasche „${tasche.teil.name}“ passt farblich dazu.`);
    }
  }

  const farben = farbenVon(imOutfit());
  if (farben.length <= MAX_FARBEN && farben.length > 0) {
    gruende.push(`Farblich passt es: ${aufzaehlen(farben.map((farbe) => nameVon(FARBEN, farbe)))}.`);
  }

  // Wo gibt es noch gar nichts mit der passenden Wärme? Dann freundlich sagen, was fehlt.
  const ohnePassendes = gewaehlt
    .map(({ teil }) => teil.kategorie)
    .filter((kategorie) => kategorie !== "accessoire" &&
      !teile.some((teil) => teil.kategorie === kategorie && teil.waerme === waerme))
    .map((kategorie) => nameVon(KATEGORIEN, kategorie));
  if (ohnePassendes.length) {
    hinweise.push(`Noch nichts mit Wärme „${nameVon(WAERME, waerme)}“ bei: ${ohnePassendes.join(", ")}. Ich habe das Passendste genommen.`);
  }
  if (gewaehlt.some(({ teil }) => aehnlich.has(teil.id))) {
    gruende.push("Mit dabei: Sachen, die du bei ähnlichem Wetter schon getragen hast.");
  }
  if (anlass && !gewaehlt.some(({ teil }) => (teil.anlaesse || []).includes(anlass))) {
    hinweise.push(`Für „${nameVon(ANLAESSE, anlass)}“ hast du noch keine Stücke markiert.`);
  }

  // Tipps zu Farben und Tasche (z. B. wenn der Kleiderschrank nicht genug passende Farben hat)
  hinweise.push(...kombiTipps(imOutfit(), teile));

  const sortiert = gewaehlt
    .map(({ teil }) => teil)
    .sort((a, b) => OUTFIT_REIHENFOLGE.indexOf(a.kategorie) - OUTFIT_REIHENFOLGE.indexOf(b.kategorie));
  return { teile: sortiert, gruende, hinweise };
}

function waermeWort(waerme) {
  return { leicht: "leichte", mittel: "mittelwarme", warm: "warme" }[waerme];
}

// Die Teile, die 1 oder 2 Tage vor diesem Tag getragen wurden
function zuletztGetragen(getragen, datum) {
  const ids = new Set();
  const heuteZeit = new Date(`${datum}T12:00`).getTime();
  for (const eintrag of getragen) {
    const tageHer = Math.round((heuteZeit - new Date(`${eintrag.datum}T12:00`).getTime()) / 86400000);
    if (tageHer >= 1 && tageHer <= 2) for (const id of eintrag.teile) ids.add(id);
  }
  return ids;
}
