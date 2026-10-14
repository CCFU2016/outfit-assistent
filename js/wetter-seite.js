// wetter-seite.js – der Bereich „Wetter“: das Wetter der nächsten Tage
// und für jeden Tag ein Outfit-Vorschlag aus deinem Kleiderschrank

import { alleTeile, alleGetragen } from "./speicher.js";
import { ANLAESSE } from "./daten.js";
import { bildAdressen, fotoBild } from "./bilder.js";
import { ortBestimmen, ortAuswaehlen } from "./ort-auswahl.js";
import { gespeicherterOrt, wetterTage } from "./wetter.js";
import { planeVorschlaege } from "./vorschlag.js";
import { outfitUebernehmen } from "./outfit.js";

// Wie viele Tage? Heute und die 4 Tage danach.
// (Weiter in die Zukunft wird die Vorhersage zu ungenau, um danach Kleidung auszusuchen.)
const ANZAHL_TAGE = 5;
// So lange merkt sich die App das Wetter, bevor sie es neu holt
const WETTER_MERKEN_MINUTEN = 30;

const inhalt = document.getElementById("wetter-inhalt");
const ortBehaelter = document.getElementById("wetter-ort");
const ortZeile = document.getElementById("wetter-ort-zeile");

let tage = null;          // das Wetter, heute zuerst
let geholtFuer = null;    // { ort, zeit }: für welchen Ort und wann das Wetter geholt wurde
let gewaehlterTag = 0;    // 0 = heute, 1 = morgen, …
let anlass = null;        // null = egal, sonst z. B. "schule"
let teile = [];
let getragen = [];
const bilder = bildAdressen();

export async function zeigeWetter() {
  [teile, getragen] = await Promise.all([alleTeile(), alleGetragen()]);
  const ort = await gespeicherterOrt();
  await zeichneOrtZeile(ort);

  if (!ort) {
    zeigeOrtFrage();
    return;
  }
  await ladeWetter(ort);
}

// ---------- Noch kein Ort: freundlich danach fragen ----------
function zeigeOrtFrage() {
  const karte = document.createElement("div");
  karte.className = "karte leer";
  karte.innerHTML = `
    <svg class="leer-symbol" aria-hidden="true"><use href="#symbol-wetter"/></svg>
    <p class="leer-text">Für das Wetter braucht die App deinen Ort.</p>
    <p class="klein">Dann bekommst du für heute und die nächsten Tage einen Outfit-Vorschlag.</p>
    <button type="button" class="knopf knopf-haupt">Ort festlegen</button>`;
  karte.querySelector("button").addEventListener("click", async () => {
    inhalt.replaceChildren();
    const ort = await ortBestimmen(ortBehaelter, "Abbrechen");
    await zeichneOrtZeile(ort);
    if (ort) await ladeWetter(ort);
    else zeigeOrtFrage();
  });
  inhalt.replaceChildren(karte);
}

async function zeichneOrtZeile(ort) {
  ortZeile.replaceChildren();
  if (!ort) return;
  const aendern = document.createElement("button");
  aendern.type = "button";
  aendern.className = "link-knopf";
  aendern.textContent = "ändern";
  aendern.addEventListener("click", async () => {
    const neu = await ortAuswaehlen(ortBehaelter, "Abbrechen");
    if (neu) {
      tage = null; // anderer Ort: Wetter neu holen
      await zeigeWetter();
    }
  });
  ortZeile.append(`Wetter für: ${ort.name} · `, aendern);
}

// ---------- Wetter holen ----------
async function ladeWetter(ort) {
  const nochFrisch = tage && geholtFuer &&
    geholtFuer.ort.breite === ort.breite && geholtFuer.ort.laenge === ort.laenge &&
    Date.now() - geholtFuer.zeit < WETTER_MERKEN_MINUTEN * 60 * 1000;

  if (!nochFrisch) {
    zeigeText("Einen Moment, ich hole das Wetter …");
    try {
      tage = await wetterTage(ort, ANZAHL_TAGE);
      geholtFuer = { ort, zeit: Date.now() };
    } catch (fehler) {
      console.warn("Wetter nicht verfügbar:", fehler);
      tage = null;
      zeigeFehler();
      return;
    }
  }
  if (gewaehlterTag >= tage.length) gewaehlterTag = 0;
  zeichne();
}

function zeigeText(text) {
  const p = document.createElement("p");
  p.className = "leer-hinweis";
  p.textContent = text;
  inhalt.replaceChildren(p);
}

function zeigeFehler() {
  const karte = document.createElement("div");
  karte.className = "karte leer";
  karte.innerHTML = `
    <p class="leer-text">Das Wetter konnte nicht geladen werden.</p>
    <p class="klein">Hast du gerade Internet? Dann versuch es gleich noch einmal.</p>
    <button type="button" class="knopf knopf-zweit">Nochmal versuchen</button>`;
  karte.querySelector("button").addEventListener("click", zeigeWetter);
  inhalt.replaceChildren(karte);
}

// ---------- Alles zeichnen ----------
function zeichne() {
  const vorschlaege = planeVorschlaege(teile, tage, getragen, anlass);
  inhalt.replaceChildren(zeichneTage(), zeichneAnlaesse(), zeichneVorschlag(tage[gewaehlterTag], vorschlaege[gewaehlterTag]));
}

// Die Tage nebeneinander: Name, Symbol, Temperatur
function zeichneTage() {
  const leiste = document.createElement("div");
  leiste.className = "tage-leiste";
  tage.forEach((tag, nummer) => {
    const knopf = document.createElement("button");
    knopf.type = "button";
    knopf.className = "tag-knopf";
    knopf.setAttribute("aria-pressed", nummer === gewaehlterTag);

    const name = document.createElement("b");
    name.textContent = tagName(tag.datum, nummer);
    const temp = document.createElement("span");
    temp.className = "tag-temp";
    temp.textContent = `${tag.tempMax}°`;
    const tief = document.createElement("small");
    tief.textContent = `${tag.tempMin}°`;

    knopf.append(name, wetterSymbol(tag), temp, tief);
    knopf.setAttribute("aria-label", `${tagName(tag.datum, nummer)}: ${tag.tempMax} Grad, ${tag.regen ? "Regen" : "trocken"}`);
    knopf.addEventListener("click", () => {
      gewaehlterTag = nummer;
      zeichne();
    });
    leiste.append(knopf);
  });
  return leiste;
}

// Anlass wählen (freiwillig)
function zeichneAnlaesse() {
  const bereich = document.createElement("div");
  const titel = document.createElement("p");
  titel.className = "reihe-titel";
  titel.textContent = "Wofür? (freiwillig)";
  const leiste = document.createElement("div");
  leiste.className = "filter-leiste";
  for (const eintrag of [{ wert: null, name: "Egal" }, ...ANLAESSE]) {
    const knopf = document.createElement("button");
    knopf.type = "button";
    knopf.className = "filter-chip";
    knopf.textContent = eintrag.name;
    knopf.setAttribute("aria-pressed", anlass === eintrag.wert);
    knopf.addEventListener("click", () => {
      anlass = eintrag.wert;
      zeichne();
    });
    leiste.append(knopf);
  }
  bereich.append(titel, leiste);
  return bereich;
}

// Der Vorschlag für den gewählten Tag
function zeichneVorschlag(tag, vorschlag) {
  bilder.freigeben();
  const karte = document.createElement("div");
  karte.className = "karte vorschlag-karte";

  const kopf = document.createElement("h3");
  kopf.className = "vorschlag-titel";
  kopf.textContent = `${tagName(tag.datum, gewaehlterTag)}, ${datumKurz(tag.datum)}`;
  const wetter = document.createElement("p");
  wetter.className = "vorschlag-wetter";
  // \u00a0 ist ein Leerzeichen, an dem nicht umgebrochen wird
  wetter.textContent = `${tag.tempMax}\u00a0°C (nachts ${tag.tempMin}\u00a0°C) · ${tag.regen ? `Regen (${tag.regenProzent}\u00a0%)` : "trocken"}`;
  karte.append(kopf, wetter);

  if (teile.length === 0) {
    const leer = document.createElement("p");
    leer.textContent = "Dein Kleiderschrank ist noch leer. Leg zuerst ein paar Teile an, dann suche ich dir etwas aus.";
    const link = document.createElement("a");
    link.className = "knopf knopf-haupt knopf-breit";
    link.href = "#neues-teil";
    link.textContent = "Neues Teil";
    karte.append(leer, link);
    return karte;
  }

  // Die Fotos untereinander, wie im Outfit
  if (vorschlag.teile.length) {
    const fotos = document.createElement("div");
    fotos.className = "outfit-karte vorschlag-fotos";
    for (const teil of vorschlag.teile) {
      const unterschrift = document.createElement("figcaption");
      unterschrift.textContent = teil.name;
      const figur = document.createElement("figure");
      figur.className = "outfit-teil";
      figur.append(fotoBild(bilder.neu(teil.foto), teil.name), unterschrift);
      fotos.append(figur);
    }
    karte.append(fotos);
  }

  // Warum dieser Vorschlag?
  const gruende = document.createElement("ul");
  gruende.className = "gruende";
  for (const grund of vorschlag.gruende) {
    const punkt = document.createElement("li");
    punkt.textContent = grund;
    gruende.append(punkt);
  }
  karte.append(gruende);

  // Was fehlt noch?
  for (const hinweis of vorschlag.hinweise) {
    const p = document.createElement("p");
    p.className = "vorschlag-hinweis";
    p.textContent = hinweis;
    karte.append(p);
  }

  if (vorschlag.teile.length) {
    const uebernehmen = document.createElement("button");
    uebernehmen.type = "button";
    uebernehmen.className = "knopf knopf-haupt knopf-breit";
    uebernehmen.textContent = "Ins Outfit übernehmen";
    uebernehmen.addEventListener("click", () => {
      outfitUebernehmen(vorschlag.teile.map((teil) => teil.id));
      location.hash = "#outfit";
    });
    karte.append(uebernehmen);
  }
  return karte;
}

// ---------- Kleine Helfer ----------
// Welches Symbol? Regen → Wolke mit Tropfen, klar → Sonne, leicht bewölkt → Sonne mit Wolke, sonst Wolke
function wetterSymbol(tag) {
  let name = "symbol-wetter";
  if (tag.regen) name = "symbol-regen";
  else if (tag.code !== null && tag.code <= 1) name = "symbol-sonne";
  else if (tag.code !== null && tag.code >= 3) name = "symbol-wolke";
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "tag-symbol");
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `#${name}`);
  svg.append(use);
  return svg;
}

// "Heute", "Morgen", dann der Wochentag ("Do.")
function tagName(datum, nummer) {
  if (nummer === 0) return "Heute";
  if (nummer === 1) return "Morgen";
  return new Date(`${datum}T12:00`).toLocaleDateString("de-DE", { weekday: "short" });
}

// "2026-10-16" → "16.10."
function datumKurz(datum) {
  const [, monat, tag] = datum.split("-");
  return `${Number(tag)}.${Number(monat)}.`;
}
