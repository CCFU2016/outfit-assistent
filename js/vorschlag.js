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

import { KATEGORIEN, WAERME, ANLAESSE, OUTFIT_REIHENFOLGE, nameVon } from "./daten.js";

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
    if (tagDavor.has(teil.id)) p -= 1;
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

  const gewaehlt = [];

  // 1. Oberteil + Hose/Rock oder ein Kleid
  const oben = bestes("oberteil");
  const unten = bestes("hose-rock");
  const kleid = bestes("kleid");
  if (oben && unten && (!kleid || kleid.punkte <= (oben.punkte + unten.punkte) / 2)) {
    gewaehlt.push(oben, unten);
  } else if (kleid) {
    gewaehlt.push(kleid);
  } else {
    const fehlt = [!oben && "ein Oberteil", !unten && "eine Hose oder einen Rock"].filter(Boolean).join(" und ");
    return {
      teile: [],
      gruende,
      hinweise: [`Für einen Vorschlag brauche ich noch ${fehlt} (oder ein Kleid). Leg es im Kleiderschrank an!`],
    };
  }

  // 2. Jacke, wenn es kühl ist oder regnen soll
  const jackeNoetig = waerme !== "leicht" || tag.regen;
  if (jackeNoetig) {
    const jacke = bestes("jacke");
    if (jacke) {
      gewaehlt.push(jacke);
      if (tag.regen && jacke.teil.regenfest) gruende.push(`${jacke.teil.name}, weil sie regenfest ist.`);
    } else {
      hinweise.push(tag.regen ? "Es soll regnen, aber du hast noch keine Jacke angelegt." : "Es ist kühl, aber du hast noch keine Jacke angelegt.");
    }
    if (tag.regen && jacke && !jacke.teil.regenfest) {
      hinweise.push("Es soll regnen und du hast noch keine regenfeste Jacke. Nimm lieber einen Schirm mit! ☂️");
    }
  }

  // 3. Schuhe
  const schuhe = bestes("schuhe");
  if (schuhe) gewaehlt.push(schuhe);
  else hinweise.push("Du hast noch keine Schuhe angelegt.");

  // 4. Bei Kälte: ein warmes Accessoire (z. B. Mütze oder Schal), wenn es eins gibt
  if (waerme === "warm") {
    const accessoire = bestes("accessoire", (teil) => teil.waerme === "warm");
    if (accessoire) gewaehlt.push(accessoire);
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
    hinweise.push(`Für „${nameVon(ANLAESSE, anlass)}“ hast du noch keine Teile markiert.`);
  }

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
