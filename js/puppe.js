// puppe.js – die gezeichnete Figur für die Anziehpuppe
//
// Die Figur ist eine Zeichnung (SVG), keine Foto-Aufnahme. Man wählt nur aus:
// Hautton, Haarfarbe, Frisur und Augenfarbe.
// Natürliche Proportionen (etwa 7,5 Kopflängen), keine übertrieben dünne Modezeichnung.
//
// Die Zeichnung hat Ebenen, damit die Kleidung später dazwischen passt:
//   hinten   Haare hinter dem Körper
//   koerper  Haut, Gesicht
//   basis    schlichtes Top und Shorts
//   (hier kommt später die Kleidung)
//   vorne    Haare vor dem Gesicht und über den Schultern

export const HAUTTOENE = [
  { wert: "sehr-hell", name: "Sehr hell", farbe: "#F7E3D6", linie: "#D9B5A0" },
  { wert: "hell", name: "Hell", farbe: "#F0D0B8", linie: "#CFA88C" },
  { wert: "mittel", name: "Mittel", farbe: "#DFB291", linie: "#BB8B69" },
  { wert: "oliv", name: "Oliv", farbe: "#C99B73", linie: "#A27652" },
  { wert: "braun", name: "Braun", farbe: "#9A6A48", linie: "#77502F" },
  { wert: "dunkel", name: "Dunkel", farbe: "#6A4431", linie: "#4E2F20" },
];

export const HAARFARBEN = [
  { wert: "hellblond", name: "Hellblond", farbe: "#E4C78E", linie: "#C4A466" },
  { wert: "blond", name: "Blond", farbe: "#C99A55", linie: "#A57937" },
  { wert: "hellbraun", name: "Hellbraun", farbe: "#946640", linie: "#744B2A" },
  { wert: "dunkelbraun", name: "Dunkelbraun", farbe: "#583828", linie: "#3E2519" },
  { wert: "schwarz", name: "Schwarz", farbe: "#2B2320", linie: "#16110F" },
  { wert: "rot", name: "Rot", farbe: "#A9512F", linie: "#843A1E" },
];

export const FRISUREN = [
  { wert: "lang", name: "Lang" },
  { wert: "bob", name: "Kurz (Bob)" },
  { wert: "zopf", name: "Zopf" },
  { wert: "locken", name: "Locken" },
  { wert: "dutt", name: "Dutt" },
];

export const AUGENFARBEN = [
  { wert: "braun", name: "Braun", farbe: "#6A4428" },
  { wert: "haselnuss", name: "Haselnuss", farbe: "#8C6A3B" },
  { wert: "gruen", name: "Grün", farbe: "#5F7B4B" },
  { wert: "blau", name: "Blau", farbe: "#5A83B0" },
  { wert: "grau", name: "Grau", farbe: "#7E8B94" },
];

export const STANDARD_AUSSEHEN = { haut: "hell", haare: "dunkelbraun", frisur: "lang", augen: "braun" };

// Größe der Zeichnung (die Kleidung wird später in denselben Einheiten platziert)
export const BREITE = 300;
export const HOEHE = 760;

const BASIS = { farbe: "#EEE9E2", linie: "#CFC8BE" };  // Top: hell und schlicht
const SHORTS_FARBE = "#DCD5CB";                          // Shorts: etwas dunkler, damit man zwei Teile sieht

function finde(liste, wert) {
  return liste.find((eintrag) => eintrag.wert === wert) || liste[0];
}

// Spiegelt einen Pfad der linken Körperseite auf die rechte (x → 300 − x)
function spiegeln(pfad) {
  let istX = true;
  return pfad.replace(/-?\d+(\.\d+)?/g, (zahl) => {
    const ergebnis = istX ? String(BREITE - Number(zahl)) : zahl;
    istX = !istX;
    return ergebnis;
  });
}

// Eine symmetrische Form aus ihrer linken Hälfte: von „start“ (Mitte oben) über Kurven bis zur Mitte unten.
// Jede Kurve: [Hilfspunkt1 x, y, Hilfspunkt2 x, y, Ziel x, y]. Die rechte Hälfte wird gespiegelt.
function symmetrisch(start, kurven) {
  const punkte = [start, ...kurven.map((kurve) => kurve.slice(4))];
  let pfad = `M${start[0]},${start[1]}`;
  for (const [x1, y1, x2, y2, x, y] of kurven) pfad += ` C${x1},${y1} ${x2},${y2} ${x},${y}`;
  for (let i = kurven.length - 1; i >= 0; i--) {
    const [x1, y1, x2, y2] = kurven[i];
    const [x, y] = punkte[i];
    pfad += ` C${BREITE - x2},${y2} ${BREITE - x1},${y1} ${BREITE - x},${y}`;
  }
  return `${pfad} Z`;
}

// ---------- Körper (Arm, Bein und Ohr links; rechts gespiegelt) ----------
const ARM = "M100,172 C86,186 82,228 80,270 C78,310 72,350 68,392 C64,404 63,418 67,426 C71,433 79,432 81,423 C83,412 81,400 80,392 C84,350 90,312 94,272 C98,240 103,216 106,206 Z";
const BEIN = "M100,350 C96,420 104,480 110,540 C114,592 112,640 122,688 C121,698 116,706 115,712 C114,720 126,724 138,721 C143,719 142,708 137,688 C138,640 141,592 141,540 C142,478 146,430 150,392 Z";
const RUMPF = symmetrisch([150, 158], [
  [145, 158, 141, 156, 139, 154],
  [126, 160, 110, 162, 100, 170],
  [93, 178, 95, 196, 104, 208],
  [108, 232, 111, 254, 116, 282],
  [118, 302, 105, 324, 100, 352],
  [99, 360, 100, 366, 100, 372],
  [112, 390, 136, 394, 150, 394],
]);
const HALS = "M139,124 L139,160 Q150,168 161,160 L161,124 Z";
const KOPF = "M150,48 C172,48 186,64 186,90 C186,112 177,127 163,134 C157,137 143,137 137,134 C123,127 114,112 114,90 C114,64 128,48 150,48 Z";
const OHR = "M115,86 C109,84 108,98 112,104 C114,107 117,105 117,102 Z";

// Schlichtes Top (mit Trägern) und Shorts
const TOP = symmetrisch([150, 200], [
  [142, 200, 134, 198, 128, 196],
  [120, 200, 112, 204, 106, 206],
  [109, 230, 111, 254, 116, 284],
  [128, 286, 140, 288, 150, 288],
]);
const TRAEGER = "M126,197 L130,158 L135,158 L131,197 Z";
const SHORTS = symmetrisch([150, 284], [
  [134, 284, 122, 283, 116, 280],
  [118, 302, 105, 324, 100, 352],
  [99, 362, 99, 372, 100, 384],
  [114, 386, 130, 388, 145, 392],
  [147, 388, 148, 386, 150, 384],
]);

// Ein Stück Umriss aus kleinen Bögen (für Locken). Beginnt beim aktuellen Punkt des Pfads.
// nachAussen = 1: die Bögen wölben sich nach außen (Umriss im Uhrzeigersinn), 0: nach innen
function boegen(punkte, nachAussen = 1) {
  return punkte.map(([x, y]) => `A8,8 0 0 ${nachAussen} ${x},${y}`).join(" ");
}

// ---------- Frisuren: was hinter dem Körper liegt und was vorne ----------
const HAARE = {
  lang: {
    hinten: "M150,40 C112,40 100,66 102,104 C104,150 96,200 98,262 C112,272 128,270 136,258 C134,210 136,170 138,140 L162,140 C164,170 166,210 164,258 C172,270 188,272 202,262 C204,200 196,150 198,104 C200,66 188,40 150,40 Z",
    vorne: "M112,98 C108,58 128,42 152,42 C176,42 192,58 188,98 C190,140 196,190 200,252 C192,264 180,264 172,254 C170,212 176,150 176,100 C172,78 160,66 146,64 C134,70 126,82 124,100 C124,150 130,212 128,254 C120,264 108,264 100,252 C104,190 110,140 112,98 Z",
  },
  bob: {
    hinten: "M150,42 C114,42 102,68 104,104 C104,124 106,140 110,152 C124,158 176,158 190,152 C194,140 196,124 196,104 C198,68 186,42 150,42 Z",
    vorne: "M110,100 C106,60 126,42 152,42 C178,42 194,60 190,100 C190,118 192,136 194,150 C188,156 180,156 176,148 C176,126 176,108 174,94 C168,76 156,68 142,66 C130,72 124,86 124,102 C124,120 124,136 124,148 C120,156 112,156 106,150 C108,136 110,118 110,100 Z",
  },
  zopf: {
    hinten: "M186,74 C204,82 210,108 206,140 C204,170 210,200 204,226 C200,238 190,240 186,230 C190,204 186,176 188,148 C190,120 188,98 180,86 Z",
    vorne: "M113,96 C110,58 128,44 152,44 C176,44 192,58 188,96 C186,86 182,76 174,70 C164,64 152,64 142,66 C130,70 120,80 116,98 Z",
  },
  locken: {
    hinten: `M150,38 ${boegen([[168, 40], [184, 48], [196, 62], [202, 80], [205, 100], [206, 122], [207, 144], [206, 166], [204, 188], [199, 208], [190, 224], [176, 232]])}
      L124,232 ${boegen([[110, 224], [101, 208], [96, 188], [94, 166], [93, 144], [94, 122], [95, 100], [98, 80], [104, 62], [116, 48], [132, 40], [150, 38]])} Z`,
    vorne: `M108,170 ${boegen([[106, 152], [106, 134], [107, 116], [109, 98], [113, 80], [122, 64], [135, 53], [150, 49], [165, 53], [178, 64], [187, 80], [191, 98], [193, 116], [194, 134], [194, 152], [192, 170]])}
      C184,176 177,170 177,162 C178,138 178,116 175,98 ${boegen([[163, 78], [150, 74], [137, 78], [125, 98]], 0)} C122,116 122,138 123,162 C123,170 116,176 108,170 Z`,
  },
  dutt: {
    hinten: "M150,12 C131,12 121,25 123,39 C125,53 137,60 150,60 C163,60 175,53 177,39 C179,25 169,12 150,12 Z",
    vorne: "M113,96 C110,58 128,44 152,44 C176,44 192,58 188,96 C186,86 182,76 174,70 C164,64 152,64 142,66 C130,70 120,80 116,98 Z",
  },
};

// Gesicht: Augen, Brauen, Nase, Mund (schlicht wie in einer Modezeichnung)
function gesicht(haut, augen) {
  const auge = (x) => `
    <path d="M${x - 8},96 Q${x},90 ${x + 8},96 Q${x},100 ${x - 8},96 Z" fill="#FFFFFF"/>
    <circle cx="${x}" cy="95.6" r="3.3" fill="${augen.farbe}"/>
    <circle cx="${x}" cy="95.6" r="1.4" fill="#1E1A18"/>
    <path d="M${x - 8.5},96 Q${x},89 ${x + 8.5},95.5" fill="none" stroke="#3A2E28" stroke-width="1.4" stroke-linecap="round"/>`;
  return `
    ${auge(135.5)}${auge(164.5)}
    <path d="M127,85 Q135,81 143,84" fill="none" stroke="#4A3A30" stroke-width="1.5" stroke-linecap="round" opacity="0.8"/>
    <path d="M157,84 Q165,81 173,85" fill="none" stroke="#4A3A30" stroke-width="1.5" stroke-linecap="round" opacity="0.8"/>
    <path d="M150,100 Q148,108 146,111 Q150,113 154,111" fill="none" stroke="${haut.linie}" stroke-width="1.3" stroke-linecap="round"/>
    <path d="M142,121 Q150,126 158,121 Q150,129 142,121 Z" fill="#C27D72" opacity="0.85"/>
    <ellipse cx="129" cy="110" rx="7" ry="4" fill="#E79A8C" opacity="0.18"/>
    <ellipse cx="171" cy="110" rx="7" ry="4" fill="#E79A8C" opacity="0.18"/>`;
}

// Die ganze Figur als SVG-Text. kleidung: SVG-Text, der zwischen „basis“ und „vorne“ eingesetzt wird
export function puppeSvg(aussehen = {}, kleidung = "") {
  const haut = finde(HAUTTOENE, aussehen.haut);
  const haar = finde(HAARFARBEN, aussehen.haare);
  const augen = finde(AUGENFARBEN, aussehen.augen);
  const frisur = HAARE[aussehen.frisur] || HAARE.lang;
  const hautStil = `fill="${haut.farbe}" stroke="${haut.linie}" stroke-width="1.2" stroke-linejoin="round"`;
  const haarStil = `fill="${haar.farbe}" stroke="${haar.linie}" stroke-width="1.2" stroke-linejoin="round"`;
  const basisStil = `fill="${BASIS.farbe}" stroke="${BASIS.linie}" stroke-width="1.2" stroke-linejoin="round"`;
  const shortsStil = `fill="${SHORTS_FARBE}" stroke="${BASIS.linie}" stroke-width="1.2" stroke-linejoin="round"`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BREITE} ${HOEHE}" class="puppe-bild" role="img" aria-label="Deine Anziehpuppe">
    <g class="hinten"><path d="${frisur.hinten}" ${haarStil}/></g>
    <g class="koerper">
      <path d="${ARM}" ${hautStil}/><path d="${spiegeln(ARM)}" ${hautStil}/>
      <path d="${BEIN}" ${hautStil}/><path d="${spiegeln(BEIN)}" ${hautStil}/>
      <path d="${HALS}" ${hautStil}/>
      <path d="${RUMPF}" ${hautStil}/>
      <path d="${OHR}" ${hautStil}/><path d="${spiegeln(OHR)}" ${hautStil}/>
      <path d="${KOPF}" ${hautStil}/>
      ${gesicht(haut, augen)}
    </g>
    <g class="basis">
      <path d="${TRAEGER}" ${basisStil}/><path d="${spiegeln(TRAEGER)}" ${basisStil}/>
      <path d="${SHORTS}" ${shortsStil}/><path d="${TOP}" ${basisStil}/>
    </g>
    <g class="kleidung">${kleidung}</g>
    <g class="vorne"><path d="${frisur.vorne}" ${haarStil}/></g>
  </svg>`;
}
