// kombi.js – passen die Teile zusammen? (Farben und Tasche)
// Hier ist nur die Logik. Benutzt wird sie im Outfit-Bereich und bei den Vorschlägen.
//
// Die Regeln (von Vera festgelegt):
//   - Jede Hauptfarbe zählt, auch Schwarz, Weiß, Grau, Beige und Dunkelblau.
//   - In einem Outfit höchstens MAX_FARBEN verschiedene Farben.
//   - Mehr als ein gemustertes Teil („Bunt/gemustert“) wirkt schnell unruhig.
//   - Eine Tasche passt, wenn sie die gleiche Farbe hat wie ein anderes Teil im Outfit.
// Das sind nur Tipps: Die App verbietet nichts.

import { FARBEN, nameVon } from "./daten.js";

export const MAX_FARBEN = 3;

// ["Rot", "Weiß", "Schwarz"] → "Rot, Weiß und Schwarz"
export function aufzaehlen(namen) {
  return namen.length <= 1 ? namen.join("") : `${namen.slice(0, -1).join(", ")} und ${namen.at(-1)}`;
}

// Die verschiedenen Farben in einem Outfit, die häufigste zuerst
export function farbenVon(teile) {
  const anzahl = new Map();
  for (const teil of teile) {
    if (teil.farbe) anzahl.set(teil.farbe, (anzahl.get(teil.farbe) || 0) + 1);
  }
  return [...anzahl.entries()].sort((a, b) => b[1] - a[1]).map(([farbe]) => farbe);
}

export function istTasche(teil) {
  return teil.kategorie === "accessoire" && teil.art === "tasche";
}

// Passt die Tasche farblich zu den anderen Teilen?
export function tascheGehtZu(tasche, andere) {
  return andere.some((teil) => teil.id !== tasche.id && teil.farbe === tasche.farbe);
}

// Taschen aus dem Kleiderschrank, die farblich zu diesem Outfit passen
export function passendeTaschen(outfit, alleTeile) {
  const ohneTasche = outfit.filter((teil) => !istTasche(teil));
  return alleTeile.filter((teil) => istTasche(teil) && tascheGehtZu(teil, ohneTasche));
}

// Strafpunkte für die Farben (für die Vorschläge): je Farbe zu viel und je Muster zu viel
export function farbStrafe(teile) {
  const zuViele = Math.max(0, farbenVon(teile).length - MAX_FARBEN);
  const muster = Math.max(0, teile.filter((teil) => teil.farbe === "bunt").length - 1);
  return zuViele + muster;
}

// Freundliche Tipps zu einem Outfit (Liste mit Texten, leer = alles passt)
export function kombiTipps(outfit, alleTeile) {
  const tipps = [];
  if (outfit.length < 2) return tipps;

  const farben = farbenVon(outfit);
  if (farben.length > MAX_FARBEN) {
    const namen = farben.map((farbe) => nameVon(FARBEN, farbe));
    tipps.push(`Ziemlich viele Farben: ${namen.join(", ")}. ` +
      `Probier, bei ${MAX_FARBEN} Farben zu bleiben, z. B. ${aufzaehlen(namen.slice(0, MAX_FARBEN))}.`);
  }

  if (outfit.filter((teil) => teil.farbe === "bunt").length > 1) {
    tipps.push("Mehrere gemusterte Teile auf einmal können unruhig wirken. Kombinier ein Muster lieber mit einfarbigen Teilen.");
  }

  // Die Tasche
  const passend = passendeTaschen(outfit, alleTeile);
  const tasche = outfit.find(istTasche);
  if (tasche && !tascheGehtZu(tasche, outfit)) {
    const besser = passend.find((teil) => teil.id !== tasche.id);
    tipps.push(`Die Farbe der Tasche „${tasche.name}“ (${nameVon(FARBEN, tasche.farbe)}) kommt sonst nicht im Outfit vor.` +
      (besser ? ` Besser passt: „${besser.name}“.` : ""));
  } else if (!tasche && passend.length > 0) {
    tipps.push(`Dazu passt deine Tasche „${passend[0].name}“. 👜`);
  }
  return tipps;
}
