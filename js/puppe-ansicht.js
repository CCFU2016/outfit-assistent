// puppe-ansicht.js – die Anziehpuppe auf der Seite „Look“
//
// Zeigt die Puppe (die Zeichnung kommt aus puppe.js) mit den gewählten Stücken.
// Auf der Puppe erscheinen nur Stücke mit ausgeschnittenem Bild (Stück öffnen → „Für die Puppe“).
// Jedes Stück bekommt zuerst automatisch einen Platz (je nach Kategorie). Verschiebt man es,
// merkt sich das Stück seinen Platz („puppe“: Mitte x, oben y, Breite, Höhe in Puppen-Einheiten).

import { puppeSvg, HAUTTOENE, HAARFARBEN, FRISUREN, AUGENFARBEN, STANDARD_AUSSEHEN } from "./puppe.js";
import { teilSpeichern, einstellungLesen, cloudEinstellungSpeichern } from "./speicher.js";

const bereich = document.getElementById("puppe-bereich");
const fehltHinweis = document.getElementById("puppe-fehlt");
const werkzeuge = document.getElementById("puppe-werkzeuge");
const knopfAussehen = document.getElementById("knopf-puppe-aussehen");
const knopfVerschieben = document.getElementById("knopf-puppe-verschieben");
const aussehenFeld = document.getElementById("puppe-aussehen");

let aussehen = { ...STANDARD_AUSSEHEN };
let stuecke = [];      // die gewählten Stücke mit ausgeschnittenem Bild
let verschieben = false;
let markiert = null;   // Nummer des Stücks, das man gerade verschiebt
let svg = null;
let zeichnenNr = 0;    // zählt mit, damit ein altes, langsames Zeichnen nichts überschreibt

const verhaeltnisse = new Map(); // Seitenverhältnis (Breite / Höhe) pro Bild
const adressen = new Map();      // blob:-Adresse pro Bild (bleibt gleich, damit nichts flackert)

// ---------- Anzeigen ----------
export async function zeigePuppe(gewaehlt) {
  const nummer = ++zeichnenNr;
  aussehen = { ...STANDARD_AUSSEHEN, ...(await einstellungLesen("puppe")) };
  const mitBild = gewaehlt.filter((teil) => teil.ausgeschnitten instanceof Blob);
  for (const teil of mitBild) await verhaeltnisMessen(teil);
  if (nummer !== zeichnenNr) return;
  stuecke = mitBild;
  if (!stuecke.some((teil) => teil.id === markiert)) markiert = null;
  zeichne();
  zeigeFehlende(gewaehlt.filter((teil) => !(teil.ausgeschnitten instanceof Blob)));
  markiereAussehen();
}

function zeichne() {
  const ebenen = { kleidung: [], obenauf: [] };
  const benutzt = new Set();
  for (const teil of [...stuecke].sort((a, b) => ebeneVon(a) - ebeneVon(b))) {
    const schluessel = bildSchluessel(teil);
    benutzt.add(schluessel);
    if (!adressen.has(schluessel)) adressen.set(schluessel, URL.createObjectURL(teil.ausgeschnitten));
    const bild = `<image class="puppe-stueck" data-id="${maskiert(teil.id)}" href="${adressen.get(schluessel)}"
      preserveAspectRatio="none" ${lage(platzVon(teil))}/>`;
    (ebeneVon(teil) >= OBENAUF ? ebenen.obenauf : ebenen.kleidung).push(bild);
  }
  // Adressen von Bildern, die nicht mehr zu sehen sind, wieder freigeben
  for (const [schluessel, adresse] of adressen) {
    if (!benutzt.has(schluessel)) {
      URL.revokeObjectURL(adresse);
      adressen.delete(schluessel);
    }
  }
  bereich.innerHTML = puppeSvg(aussehen, { kleidung: ebenen.kleidung.join(""), obenauf: ebenen.obenauf.join("") });
  svg = bereich.querySelector("svg");
  svg.classList.toggle("verschieben", verschieben);
  svg.insertAdjacentHTML("beforeend", `<rect class="puppe-markierung" fill="none" stroke="#1C1C1C" stroke-width="1.5" stroke-dasharray="5 4" style="display: none"/>`);
  zeigeMarkierung();
}

function lage(platz) {
  return `x="${platz.x - platz.breite / 2}" y="${platz.y}" width="${platz.breite}" height="${platz.hoehe}"`;
}

function zeigeMarkierung() {
  const rahmen = svg.querySelector(".puppe-markierung");
  const teil = markiertesTeil();
  rahmen.style.display = verschieben && teil ? "" : "none"; // (SVG kennt kein „hidden“)
  for (const knopf of werkzeuge.querySelectorAll("button")) knopf.disabled = !teil;
  if (!teil) return;
  const platz = platzVon(teil);
  rahmen.setAttribute("x", platz.x - platz.breite / 2 - 3);
  rahmen.setAttribute("y", platz.y - 3);
  rahmen.setAttribute("width", platz.breite + 6);
  rahmen.setAttribute("height", platz.hoehe + 6);
}

// Ausgewählte Stücke ohne ausgeschnittenes Bild: kurz sagen, wie es geht
function zeigeFehlende(fehlende) {
  fehltHinweis.hidden = fehlende.length === 0;
  if (fehlende.length === 0) return;
  const links = fehlende.map((teil) => {
    const link = document.createElement("a");
    link.href = `#teil/${encodeURIComponent(teil.id)}`;
    link.textContent = teil.name;
    return link;
  });
  fehltHinweis.replaceChildren("Noch nicht ausgeschnitten: ");
  links.forEach((link, i) => fehltHinweis.append(...(i ? [", ", link] : [link])));
  fehltHinweis.append(". Tippe darauf und setze unter „Für die Puppe“ ein ausgeschnittenes Bild ein.");
}

// ---------- Wo kommt ein Stück hin? ----------
// Reihenfolge von unten nach oben. Ab OBENAUF liegt es über den Haaren.
const EBENEN = ["hose-rock", "kleid", "oberteil", "schuhe", "jacke", "guertel", "schmuck"];
const OBENAUF = EBENEN.length;

function ebeneVon(teil) {
  const stelle = EBENEN.indexOf(teil.kategorie === "accessoire" ? teil.art : teil.kategorie);
  return stelle >= 0 ? stelle : OBENAUF; // Mütze, Schal, Tasche, Sonstiges
}

function platzVon(teil) {
  return teil.puppe || standardPlatz(teil);
}

// Der automatische Platz, je nach Kategorie. Alle Zahlen in Puppen-Einheiten (300 breit, 760 hoch).
function standardPlatz(teil) {
  const v = verhaeltnisse.get(bildSchluessel(teil)) || 1; // Breite / Höhe des Bilds
  // So breit wie gewünscht, aber nicht höher als maxHoehe
  const passe = (breite, maxHoehe) => {
    let hoehe = breite / v;
    if (hoehe > maxHoehe) {
      hoehe = maxHoehe;
      breite = hoehe * v;
    }
    return { breite, hoehe };
  };
  // Lange Stücke (Hose, langes Kleid) über die ganze Länge; zu breite Fotos werden etwas schmaler gemacht
  const lang = (hoehe, maxBreite) => ({ hoehe, breite: Math.min(hoehe * v, maxBreite) });

  const art = teil.kategorie === "accessoire" ? accessoireStelle(teil) : teil.kategorie;
  switch (art) {
    case "oberteil": return { x: 150, y: 150, ...passe(140, 230) };
    case "jacke": return { x: 150, y: 146, ...passe(164, 320) };
    case "kleid": return { x: 150, y: 150, ...(v < 0.7 ? lang(400, 170) : passe(156, 420)) };
    case "hose-rock": return { x: 150, y: 278, ...(v < 0.8 ? lang(412, 142) : passe(132, 300)) };
    case "schuhe": { const groesse = passe(100, 74); return { x: 150, y: 728 - groesse.hoehe, ...groesse }; }
    case "tasche": return { x: 54, y: 376, ...passe(84, 110) };
    case "muetze": { const groesse = passe(108, 84); return { x: 150, y: 84 - groesse.hoehe, ...groesse }; }
    case "schal": return { x: 150, y: 128, ...passe(112, 170) };
    case "schmuck": return { x: 150, y: 150, ...passe(56, 80) };
    case "guertel": return { x: 150, y: 282, ...passe(124, 32) };
    default: return { x: 250, y: 300, ...passe(74, 110) };
  }
}

// Mütze oder Schal? (beides ist dieselbe Art) – am Namen erkennen
function accessoireStelle(teil) {
  if (teil.art !== "muetze-schal") return teil.art;
  return /mütze|muetze|hut|cap|kappe|beanie|stirnband/i.test(teil.name) ? "muetze" : "schal";
}

function bildSchluessel(teil) {
  return `${teil.id}:${teil.ausgeschnitten.size}`;
}

async function verhaeltnisMessen(teil) {
  const schluessel = bildSchluessel(teil);
  if (verhaeltnisse.has(schluessel)) return;
  const bild = await createImageBitmap(teil.ausgeschnitten);
  verhaeltnisse.set(schluessel, bild.width / bild.height);
  bild.close();
}

function maskiert(text) {
  return String(text).replace(/[&<>"']/g, (zeichen) => `&#${zeichen.charCodeAt(0)};`);
}

// ---------- Verschieben und Größe ändern ----------
// Ein Finger: verschieben. Zwei Finger: größer oder kleiner. Dazu Knöpfe für alle, die lieber tippen.
knopfVerschieben.addEventListener("click", () => {
  verschieben = !verschieben;
  if (!verschieben) markiert = null;
  else if (!markiert && stuecke.length) markiert = [...stuecke].sort((a, b) => ebeneVon(b) - ebeneVon(a))[0].id;
  knopfVerschieben.textContent = verschieben ? "Fertig" : "Stücke verschieben";
  knopfVerschieben.setAttribute("aria-pressed", verschieben);
  werkzeuge.hidden = !verschieben;
  aussehenFeld.hidden = true;
  knopfAussehen.setAttribute("aria-pressed", false);
  svg?.classList.toggle("verschieben", verschieben);
  zeigeMarkierung();
});

const zeiger = new Map(); // Finger auf der Puppe: Nummer → Punkt in Puppen-Einheiten
let anfang = null;        // Platz und Finger beim Start einer Bewegung

bereich.addEventListener("pointerdown", (ereignis) => {
  if (!verschieben || !svg) return;
  if (zeiger.size === 0) {
    const ziel = ereignis.target.closest?.(".puppe-stueck");
    if (ziel) markiert = ziel.dataset.id;
    zeigeMarkierung();
    if (!ziel) return;
  }
  if (!markiertesTeil()) return;
  ereignis.preventDefault();
  bereich.setPointerCapture(ereignis.pointerId);
  zeiger.set(ereignis.pointerId, punktIn(ereignis));
  neuerAnfang();
});

bereich.addEventListener("pointermove", (ereignis) => {
  if (!zeiger.has(ereignis.pointerId) || !anfang) return;
  zeiger.set(ereignis.pointerId, punktIn(ereignis));
  const teil = markiertesTeil();
  if (!teil) return;
  const [jetztA, jetztB] = [...zeiger.values()];
  const [vorherA, vorherB] = [...anfang.zeiger.values()];
  const platz = { ...anfang.platz };
  if (jetztB && vorherB) {
    // Zwei Finger: Abstand ändert die Größe, die Mitte zwischen den Fingern verschiebt
    const faktor = abstand(jetztA, jetztB) / Math.max(1, abstand(vorherA, vorherB));
    platz.breite *= faktor;
    platz.hoehe *= faktor;
    platz.x += (jetztA.x + jetztB.x - vorherA.x - vorherB.x) / 2;
    platz.y += (jetztA.y + jetztB.y - vorherA.y - vorherB.y) / 2 - (platz.hoehe - anfang.platz.hoehe) / 2;
  } else {
    platz.x += jetztA.x - vorherA.x;
    platz.y += jetztA.y - vorherA.y;
  }
  setzePlatz(teil, platz, false);
});

for (const ende of ["pointerup", "pointercancel"]) {
  bereich.addEventListener(ende, (ereignis) => {
    if (!zeiger.delete(ereignis.pointerId)) return;
    if (zeiger.size > 0) neuerAnfang();
    else {
      anfang = null;
      const teil = markiertesTeil();
      if (teil) speichereSpaeter(teil);
    }
  });
}

// Knöpfe: kleiner, größer, schmaler, breiter, zurücksetzen
werkzeuge.addEventListener("click", (ereignis) => {
  const aktion = ereignis.target.closest("button")?.dataset.aktion;
  const teil = markiertesTeil();
  if (!aktion || !teil) return;
  const platz = { ...platzVon(teil) };
  const groesse = { kleiner: 0.92, groesser: 1.08 }[aktion];
  const breite = { schmaler: 0.92, breiter: 1.08 }[aktion];
  if (groesse) {
    platz.y += (platz.hoehe - platz.hoehe * groesse) / 2; // um die Mitte herum
    platz.breite *= groesse;
    platz.hoehe *= groesse;
  }
  if (breite) platz.breite *= breite;
  setzePlatz(teil, aktion === "zuruecksetzen" ? null : platz, true);
});

function setzePlatz(teil, platz, sofortSpeichern) {
  teil.puppe = platz && {
    x: begrenzt(platz.x, 0, 300),
    y: begrenzt(platz.y, -150, 740),
    breite: begrenzt(platz.breite, 16, 420),
    hoehe: begrenzt(platz.hoehe, 10, 900),
  };
  const bild = [...svg.querySelectorAll(".puppe-stueck")].find((element) => element.dataset.id === teil.id);
  const neu = platzVon(teil);
  bild?.setAttribute("x", neu.x - neu.breite / 2);
  bild?.setAttribute("y", neu.y);
  bild?.setAttribute("width", neu.breite);
  bild?.setAttribute("height", neu.hoehe);
  zeigeMarkierung();
  if (sofortSpeichern) speichereSpaeter(teil);
}

const speicherWecker = new Map();
function speichereSpaeter(teil) {
  clearTimeout(speicherWecker.get(teil.id));
  speicherWecker.set(teil.id, setTimeout(() => {
    teil.geaendertAm = new Date().toISOString(); // damit die Cloud den neuen Platz übernimmt
    teilSpeichern(teil).catch((fehler) => console.error(fehler));
  }, 800));
}

function neuerAnfang() {
  const teil = markiertesTeil();
  anfang = teil ? { platz: { ...platzVon(teil) }, zeiger: new Map(zeiger) } : null;
}

function markiertesTeil() {
  return stuecke.find((teil) => teil.id === markiert) || null;
}

function punktIn(ereignis) {
  const umrechnung = svg.getScreenCTM().inverse();
  return new DOMPoint(ereignis.clientX, ereignis.clientY).matrixTransform(umrechnung);
}

function abstand(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function begrenzt(wert, min, max) {
  return Math.min(max, Math.max(min, wert));
}

// ---------- Aussehen: Hautton, Haare, Frisur, Augen ----------
const AUSWAHL = [
  { feld: "haut", titel: "Hautton", liste: HAUTTOENE },
  { feld: "haare", titel: "Haarfarbe", liste: HAARFARBEN },
  { feld: "frisur", titel: "Frisur", liste: FRISUREN },
  { feld: "augen", titel: "Augenfarbe", liste: AUGENFARBEN },
];

for (const { feld, titel, liste } of AUSWAHL) {
  const gruppe = document.createElement("fieldset");
  gruppe.className = "feld";
  const legende = document.createElement("legend");
  legende.className = "feld-titel";
  legende.textContent = titel;
  const chips = document.createElement("div");
  chips.className = "chips";
  for (const eintrag of liste) {
    const eingabe = document.createElement("input");
    eingabe.type = "radio";
    eingabe.name = `puppe-${feld}`;
    eingabe.value = eintrag.wert;
    const text = document.createElement("span");
    if (eintrag.farbe) {
      const punkt = document.createElement("i");
      punkt.className = "farbpunkt";
      punkt.style.setProperty("--farbe", eintrag.farbe);
      text.append(punkt);
    }
    text.append(eintrag.name);
    const chip = document.createElement("label");
    chip.className = "chip";
    chip.append(eingabe, text);
    chips.append(chip);
  }
  gruppe.append(legende, chips);
  aussehenFeld.append(gruppe);
}

aussehenFeld.addEventListener("change", (ereignis) => {
  const feld = ereignis.target.name?.replace("puppe-", "");
  if (!feld) return;
  aussehen = { ...aussehen, [feld]: ereignis.target.value };
  zeichne();
  const { haut, haare, frisur, augen } = aussehen;
  cloudEinstellungSpeichern("puppe", { haut, haare, frisur, augen }).catch((fehler) => console.error(fehler));
});

knopfAussehen.addEventListener("click", () => {
  aussehenFeld.hidden = !aussehenFeld.hidden;
  knopfAussehen.setAttribute("aria-pressed", !aussehenFeld.hidden);
  markiereAussehen();
});

function markiereAussehen() {
  for (const { feld } of AUSWAHL) {
    for (const eingabe of aussehenFeld.querySelectorAll(`input[name="puppe-${feld}"]`)) {
      eingabe.checked = eingabe.value === aussehen[feld];
    }
  }
}
