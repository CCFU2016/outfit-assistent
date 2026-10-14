// ort-auswahl.js – eine Karte, in der man den Ort fürs Wetter festlegt:
// entweder „Standort verwenden“ oder eine Stadt eintippen.
// Wird im Outfit-Bereich und im Wetter-Bereich benutzt.

import { gespeicherterOrt, ortSpeichern, standortAbfragen, stadtSuchen } from "./wetter.js";

// Den Ort fürs Wetter bestimmen:
// 1. gespeicherter Ort, sonst 2. Standort des Handys, sonst 3. Stadt eintippen lassen.
// Ergebnis: der Ort, oder null, wenn man ohne Wetter weitermachen möchte.
// zweiterKnopf: Text für den Knopf, der ohne Ort weitermacht.
export async function ortBestimmen(behaelter, zweiterKnopf = "Ohne Wetter speichern") {
  const gespeichert = await gespeicherterOrt();
  if (gespeichert) return gespeichert;
  try {
    const ort = await standortAbfragen();
    await ortSpeichern(ort);
    return ort;
  } catch {
    return ortAuswaehlen(behaelter, zweiterKnopf);
  }
}

// Zeigt die Karte im Behälter und wartet, bis ein Ort gewählt ist.
// zweiterKnopf: Text für den Knopf, der ohne Ort weitermacht (Ergebnis dann: null).
export function ortAuswaehlen(behaelter, zweiterKnopf = "Abbrechen") {
  return new Promise((fertig) => {
    const karte = document.createElement("div");
    karte.className = "karte ort-karte";
    karte.innerHTML = `
      <p class="feld-titel">Wo bist du?</p>
      <p class="klein">Für das Wetter braucht die App deinen Ort. Er bleibt auf deinem Handy.</p>
      <button type="button" class="knopf knopf-zweit knopf-breit" data-aktion="standort">Meinen Standort verwenden</button>
      <form class="stadt-formular">
        <input class="eingabe" type="search" placeholder="oder Stadt eingeben, z. B. Berlin" enterkeyhint="search" aria-label="Stadt">
        <button class="knopf knopf-haupt" type="submit">Suchen</button>
      </form>
      <p class="ort-meldung klein" hidden></p>
      <div class="stadt-treffer"></div>
      <button type="button" class="link-knopf" data-aktion="ohne">${zweiterKnopf}</button>`;

    const meldung = karte.querySelector(".ort-meldung");
    const trefferListe = karte.querySelector(".stadt-treffer");

    function zeigeMeldung(text) {
      meldung.textContent = text;
      meldung.hidden = !text;
    }

    async function fertigMit(ort) {
      if (ort) await ortSpeichern(ort);
      behaelter.hidden = true;
      behaelter.replaceChildren();
      fertig(ort);
    }

    // „Meinen Standort verwenden“
    karte.querySelector('[data-aktion="standort"]').addEventListener("click", async () => {
      zeigeMeldung("Standort wird bestimmt …");
      try {
        fertigMit(await standortAbfragen());
      } catch {
        zeigeMeldung("Den Standort durfte oder konnte die App nicht abfragen. Gib einfach deine Stadt ein.");
      }
    });

    // Stadt suchen
    karte.querySelector(".stadt-formular").addEventListener("submit", async (ereignis) => {
      ereignis.preventDefault();
      const text = karte.querySelector('input[type="search"]').value.trim();
      if (!text) return;
      zeigeMeldung("Suche …");
      trefferListe.replaceChildren();
      try {
        const treffer = await stadtSuchen(text);
        zeigeMeldung(treffer.length ? "Tippe auf deine Stadt:" : "Keine Stadt gefunden. Prüf die Schreibweise.");
        for (const ort of treffer) {
          const knopf = document.createElement("button");
          knopf.type = "button";
          knopf.className = "treffer";
          const name = document.createElement("b");
          name.textContent = ort.name;
          const gegend = document.createElement("span");
          gegend.textContent = ort.gegend;
          knopf.append(name, gegend);
          knopf.addEventListener("click", () => fertigMit({ name: ort.name, breite: ort.breite, laenge: ort.laenge }));
          trefferListe.append(knopf);
        }
      } catch {
        zeigeMeldung("Die Suche geht gerade nicht. Hast du Internet?");
      }
    });

    // Ohne Ort weitermachen
    karte.querySelector('[data-aktion="ohne"]').addEventListener("click", () => fertigMit(null));

    behaelter.replaceChildren(karte);
    behaelter.hidden = false;
    karte.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}
