// outfit.js – Outfit zusammenstellen und „Heute getragen“ speichern

import {
  alleTeile, alleGetragen, getragenLaden, getragenSpeichern, getragenLoeschen, bitteUmDauerhaftenSpeicher,
} from "./speicher.js";
import { KATEGORIEN, OUTFIT_REIHENFOLGE, nameVon } from "./daten.js";
import { bildAdressen, fotoBild } from "./bilder.js";
import { ortBestimmen, ortAuswaehlen } from "./ort-auswahl.js";
import { gespeicherterOrt, wetterHolen, wetterText } from "./wetter.js";

const auswahlBereich = document.getElementById("outfit-auswahl");
const vorschau = document.getElementById("outfit-vorschau");
const knopfGetragen = document.getElementById("knopf-getragen");
const status = document.getElementById("outfit-status");
const ortZeile = document.getElementById("outfit-ort-zeile");
const ortBehaelter = document.getElementById("outfit-ort");
const verlaufListe = document.getElementById("getragen-liste");

const auswahl = new Set(); // die Nummern (ids) der gewählten Teile
let teile = [];            // alle Teile aus dem Kleiderschrank

const reihenBilder = bildAdressen();
const vorschauBilder = bildAdressen();
const verlaufBilder = bildAdressen();

export async function zeigeOutfit() {
  teile = await alleTeile();
  // Teile, die inzwischen gelöscht wurden, aus der Auswahl nehmen
  for (const id of auswahl) {
    if (!teilMitNummer(id)) auswahl.delete(id);
  }
  zeichneAuswahl();
  zeichneVorschau();
  await zeichneOrtZeile();
  await zeichneVerlauf();
}

// Für den Wettervorschlag (Schritt 1.3): ein fertiges Outfit übernehmen
export function outfitUebernehmen(nummern) {
  auswahl.clear();
  for (const id of nummern) auswahl.add(id);
}

function teilMitNummer(id) {
  return teile.find((teil) => teil.id === id);
}

function vonObenNachUnten(a, b) {
  return OUTFIT_REIHENFOLGE.indexOf(a.kategorie) - OUTFIT_REIHENFOLGE.indexOf(b.kategorie);
}

// ---------- 1. Teile auswählen: eine Reihe pro Kategorie ----------
function zeichneAuswahl() {
  reihenBilder.freigeben();
  auswahlBereich.replaceChildren();

  if (teile.length === 0) {
    const hinweis = document.createElement("div");
    hinweis.className = "karte leer";
    hinweis.innerHTML = `<p class="leer-text">Dein Kleiderschrank ist noch leer.</p>
      <p class="klein">Leg zuerst ein paar Teile an, dann kannst du hier Outfits zusammenstellen.</p>
      <a class="knopf knopf-haupt" href="#neues-teil">Neues Teil</a>`;
    auswahlBereich.append(hinweis);
    return;
  }

  for (const kategorie of OUTFIT_REIHENFOLGE) {
    const inKategorie = teile.filter((teil) => teil.kategorie === kategorie);
    if (inKategorie.length === 0) continue;

    const titel = document.createElement("h3");
    titel.className = "reihe-titel";
    titel.textContent = nameVon(KATEGORIEN, kategorie);
    if (kategorie === "accessoire") titel.textContent += " (mehrere möglich)";

    const leiste = document.createElement("div");
    leiste.className = "reihe-teile";
    for (const teil of inKategorie) {
      const knopf = document.createElement("button");
      knopf.type = "button";
      knopf.className = "mini";
      knopf.dataset.id = teil.id;
      knopf.setAttribute("aria-pressed", auswahl.has(teil.id));
      const name = document.createElement("span");
      name.textContent = teil.name;
      knopf.append(fotoBild(reihenBilder.neu(teil.vorschau), ""), name);
      knopf.addEventListener("click", () => waehle(teil));
      leiste.append(knopf);
    }

    const reihe = document.createElement("div");
    reihe.className = "reihe";
    reihe.append(titel, leiste);
    auswahlBereich.append(reihe);
  }
}

// Ein Teil antippen: auswählen oder wieder abwählen
function waehle(teil) {
  if (auswahl.has(teil.id)) {
    auswahl.delete(teil.id);
  } else {
    // Pro Kategorie nur ein Teil (außer Accessoires): das bisherige abwählen
    if (teil.kategorie !== "accessoire") {
      for (const id of auswahl) {
        if (teilMitNummer(id)?.kategorie === teil.kategorie) auswahl.delete(id);
      }
    }
    auswahl.add(teil.id);
  }
  // Nur die Markierungen ändern; die Bilder bleiben (das geht schneller)
  for (const knopf of auswahlBereich.querySelectorAll(".mini")) {
    knopf.setAttribute("aria-pressed", auswahl.has(knopf.dataset.id));
  }
  zeichneVorschau();
  status.hidden = true;
}

// ---------- 2. Das Outfit: Fotos untereinander ----------
function zeichneVorschau() {
  vorschauBilder.freigeben();
  const gewaehlt = [...auswahl].map(teilMitNummer).filter(Boolean).sort(vonObenNachUnten);

  if (gewaehlt.length === 0) {
    const hinweis = document.createElement("p");
    hinweis.className = "leer-hinweis";
    hinweis.textContent = teile.length ? "Noch nichts ausgewählt. Tippe oben auf deine Teile." : "Noch keine Teile da.";
    vorschau.replaceChildren(hinweis);
  } else {
    vorschau.replaceChildren(...gewaehlt.map((teil) => {
      const unterschrift = document.createElement("figcaption");
      unterschrift.textContent = teil.name;

      const weg = document.createElement("button");
      weg.type = "button";
      weg.className = "weg-knopf";
      weg.textContent = "×";
      weg.setAttribute("aria-label", `${teil.name} aus dem Outfit nehmen`);
      weg.addEventListener("click", () => waehle(teil));

      const figur = document.createElement("figure");
      figur.className = "outfit-teil";
      figur.append(fotoBild(vorschauBilder.neu(teil.foto), teil.name), unterschrift, weg);
      return figur;
    }));
  }
  knopfGetragen.disabled = gewaehlt.length === 0;
}

// ---------- Ort fürs Wetter ----------
async function zeichneOrtZeile() {
  const ort = await gespeicherterOrt();
  ortZeile.replaceChildren();
  if (!ort) return; // wird beim ersten „Heute getragen“ abgefragt

  const aendern = document.createElement("button");
  aendern.type = "button";
  aendern.className = "link-knopf";
  aendern.textContent = "ändern";
  aendern.addEventListener("click", async () => {
    await ortAuswaehlen(ortBehaelter, "Abbrechen");
    await zeichneOrtZeile();
  });
  ortZeile.append(`Wetter für: ${ort.name} · `, aendern);
}

// ---------- 3. „Heute getragen“ ----------
knopfGetragen.addEventListener("click", async () => {
  if (auswahl.size === 0) return;
  const datum = heute();
  if ((await getragenLaden(datum)) && !confirm("Für heute ist schon ein Outfit gespeichert. Durch dieses ersetzen?")) {
    return;
  }

  knopfGetragen.disabled = true;
  status.hidden = true;

  // Das Wetter von heute holen (dafür braucht die App deinen Ort)
  let wetter = null;
  try {
    const ort = await ortBestimmen(ortBehaelter);
    if (ort) {
      zeigeStatus("Einen Moment, ich hole das Wetter …");
      wetter = (await wetterHolen(ort)).heute;
    }
  } catch (fehler) {
    console.warn("Wetter nicht verfügbar:", fehler);
  }

  try {
    await getragenSpeichern({ id: datum, datum, teile: [...auswahl], wetter, gespeichertAm: new Date().toISOString() });
    bitteUmDauerhaftenSpeicher();
    zeigeStatus(wetter
      ? `Gespeichert! Heute: ${wetterText(wetter)}.`
      : "Gespeichert, aber ohne Wetter (kein Ort oder kein Internet).");
  } catch (fehler) {
    console.error(fehler);
    zeigeStatus("Speichern hat leider nicht geklappt.");
  }
  knopfGetragen.disabled = false;
  await zeichneOrtZeile();
  await zeichneVerlauf();
});

function zeigeStatus(text) {
  status.textContent = text;
  status.hidden = false;
}

// ---------- Zuletzt getragen ----------
async function zeichneVerlauf() {
  verlaufBilder.freigeben();
  const eintraege = (await alleGetragen())
    .sort((a, b) => b.datum.localeCompare(a.datum)) // neueste zuerst
    .slice(0, 7);

  if (eintraege.length === 0) {
    const hinweis = document.createElement("p");
    hinweis.className = "klein";
    hinweis.textContent = "Noch nichts gespeichert. Stell ein Outfit zusammen und tippe auf „Heute getragen“.";
    verlaufListe.replaceChildren(hinweis);
    return;
  }

  verlaufListe.replaceChildren(...eintraege.map((eintrag) => {
    const kopf = document.createElement("div");
    kopf.className = "verlauf-kopf";
    const tag = document.createElement("b");
    tag.textContent = datumText(eintrag.datum);
    const wetter = document.createElement("span");
    wetter.textContent = eintrag.wetter ? wetterText(eintrag.wetter) : "ohne Wetter";
    const weg = document.createElement("button");
    weg.type = "button";
    weg.className = "weg-knopf";
    weg.textContent = "×";
    weg.setAttribute("aria-label", `Eintrag vom ${datumText(eintrag.datum)} löschen`);
    weg.addEventListener("click", async () => {
      if (!confirm(`Den Eintrag vom ${datumText(eintrag.datum)} löschen?`)) return;
      await getragenLoeschen(eintrag.id);
      await zeichneVerlauf();
    });
    kopf.append(tag, wetter, weg);

    const bilder = document.createElement("div");
    bilder.className = "verlauf-bilder";
    const getragen = eintrag.teile.map(teilMitNummer).filter(Boolean).sort(vonObenNachUnten);
    for (const teil of getragen) bilder.append(fotoBild(verlaufBilder.neu(teil.vorschau), teil.name));

    const zeile = document.createElement("div");
    zeile.className = "verlauf-eintrag";
    zeile.append(kopf, bilder);
    return zeile;
  }));
}

// ---------- Datum ----------
// Heutiges Datum als Text "2026-10-13"
function heute() {
  const jetzt = new Date();
  const monat = String(jetzt.getMonth() + 1).padStart(2, "0");
  const tag = String(jetzt.getDate()).padStart(2, "0");
  return `${jetzt.getFullYear()}-${monat}-${tag}`;
}

// "2026-10-13" → "Di., 13.10."
function datumText(datum) {
  return new Date(`${datum}T12:00`).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "numeric" });
}
