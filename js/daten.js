// daten.js – die festen Auswahl-Listen der App
// Jeder Eintrag hat einen "wert" (so wird er gespeichert)
// und einen "name" (so wird er angezeigt).
// Die Reihenfolge hier ist auch die Reihenfolge in der App.

export const KATEGORIEN = [
  { wert: "oberteil", name: "Oberteil" },
  { wert: "hose-rock", name: "Hose/Rock" },
  { wert: "kleid", name: "Kleid" },
  { wert: "jacke", name: "Jacke" },
  { wert: "schuhe", name: "Schuhe" },
  { wert: "accessoire", name: "Accessoire" },
];

// So stehen die Teile im Outfit untereinander: von oben nach unten
export const OUTFIT_REIHENFOLGE = ["jacke", "oberteil", "kleid", "hose-rock", "schuhe", "accessoire"];

// Die Temperaturen sind Richtwerte. Der Wettervorschlag (Schritt 1.3) benutzt sie.
export const WAERME = [
  { wert: "leicht", name: "leicht", hinweis: "ab ca. 20 °C" },
  { wert: "mittel", name: "mittel", hinweis: "ca. 12–20 °C" },
  { wert: "warm", name: "warm", hinweis: "unter 12 °C" },
];

// Hauptfarbe des Kleidungsstücks, mit Farbtupfer zum Erkennen
export const FARBEN = [
  { wert: "schwarz", name: "Schwarz", farbe: "#1F1F1F" },
  { wert: "weiss", name: "Weiß", farbe: "#FFFFFF" },
  { wert: "grau", name: "Grau", farbe: "#9B9B9B" },
  { wert: "beige", name: "Beige", farbe: "#D8C3A0" },
  { wert: "braun", name: "Braun", farbe: "#7B5235" },
  { wert: "dunkelblau", name: "Dunkelblau", farbe: "#1F3A68" },
  { wert: "blau", name: "Blau", farbe: "#3D7BD6" },
  { wert: "hellblau", name: "Hellblau", farbe: "#A9CDEF" },
  { wert: "gruen", name: "Grün", farbe: "#3F8F5A" },
  { wert: "oliv", name: "Oliv", farbe: "#6B7041" },
  { wert: "rot", name: "Rot", farbe: "#C93A35" },
  { wert: "rosa", name: "Rosa", farbe: "#F2A7BC" },
  { wert: "lila", name: "Lila", farbe: "#8E6BBF" },
  { wert: "gelb", name: "Gelb", farbe: "#F2C94C" },
  { wert: "orange", name: "Orange", farbe: "#EE8A3B" },
  { wert: "bunt", name: "Bunt/gemustert", farbe: "conic-gradient(#C93A35, #F2C94C, #3F8F5A, #3D7BD6, #8E6BBF, #C93A35)" },
];

export const ANLAESSE = [
  { wert: "schule", name: "Schule" },
  { wert: "sport", name: "Sport" },
  { wert: "party", name: "Party" },
  { wert: "alltag", name: "Alltag" },
];

// Den Anzeigenamen zu einem gespeicherten Wert finden, z. B. "hose-rock" → "Hose/Rock"
export function nameVon(liste, wert) {
  const eintrag = liste.find((e) => e.wert === wert);
  return eintrag ? eintrag.name : wert;
}
