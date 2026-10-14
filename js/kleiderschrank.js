// kleiderschrank.js – zeigt alle Kleidungsstücke als Bilder, nach Kategorie filterbar

import { alleTeile } from "./speicher.js";
import { KATEGORIEN, ACCESSOIRE_ARTEN, WAERME, nameVon } from "./daten.js";
import { bildAdressen, fotoBild } from "./bilder.js";

const liste = document.getElementById("teile-liste");
const filterLeiste = document.getElementById("filter-leiste");
const filterLeer = document.getElementById("filter-leer");
const artFehlt = document.getElementById("art-fehlt");

let teile = [];          // alle Teile (neueste zuerst)
let filter = "alle";     // "alle" oder eine Kategorie, z. B. "schuhe"
const bilder = bildAdressen();

export async function zeigeKleiderschrank() {
  teile = await alleTeile();
  teile.sort((a, b) => b.erstelltAm.localeCompare(a.erstelltAm)); // neueste zuerst
  zeichne();
}

function zeichne() {
  const sichtbar = filter === "alle" ? teile : teile.filter((teil) => teil.kategorie === filter);

  bilder.freigeben();
  liste.replaceChildren(...sichtbar.map(baueKachel));
  zeichneFilter();

  document.getElementById("kleiderschrank-leer").hidden = teile.length > 0;
  document.getElementById("teile-anzahl").textContent =
    teile.length === 1 ? "1 Stück" : teile.length > 1 ? `${teile.length} Stücke` : "";

  // Hinweis, wenn in der gewählten Kategorie noch nichts ist
  filterLeer.hidden = teile.length === 0 || sichtbar.length > 0;
  filterLeer.textContent = `Noch nichts in „${nameVon(KATEGORIEN, filter)}“. Tippe auf „Neues Stück“, um etwas hinzuzufügen.`;

  // Accessoires von früher haben noch keine "Art" (z. B. Tasche)
  const ohneArt = teile.filter((teil) => teil.kategorie === "accessoire" && !teil.art);
  artFehlt.hidden = ohneArt.length === 0;
  artFehlt.textContent = ohneArt.length === 1
    ? `Tipp: Bei „${ohneArt[0].name}“ fehlt noch die Art (z. B. Tasche). Tippe es an und trag sie nach, dann passen die Vorschläge besser.`
    : `Tipp: Bei ${ohneArt.length} Accessoires fehlt noch die Art (z. B. Tasche). Tippe sie an und trag sie nach, dann passen die Vorschläge besser.`;
}

// Die Filter-Knöpfe: "Alle" und jede Kategorie mit Anzahl
function zeichneFilter() {
  filterLeiste.hidden = teile.length === 0;
  const eintraege = [{ wert: "alle", name: "Alle" }, ...KATEGORIEN];
  filterLeiste.replaceChildren(...eintraege.map((eintrag) => {
    const anzahl = eintrag.wert === "alle"
      ? teile.length
      : teile.filter((teil) => teil.kategorie === eintrag.wert).length;

    const knopf = document.createElement("button");
    knopf.type = "button";
    knopf.className = "filter-chip";
    knopf.setAttribute("aria-pressed", filter === eintrag.wert);
    const zahl = document.createElement("small");
    zahl.textContent = anzahl;
    knopf.append(eintrag.name, zahl);
    knopf.addEventListener("click", () => {
      filter = eintrag.wert;
      zeichne();
    });
    return knopf;
  }));
}

// Eine Kachel: Foto, Name und eine kurze Beschreibung. Antippen öffnet das Teil.
function baueKachel(teil) {
  const kachel = document.createElement("a");
  kachel.className = "kachel";
  kachel.href = `#teil/${teil.id}`;

  const name = document.createElement("span");
  name.className = "kachel-name";
  name.textContent = teil.name;

  const info = document.createElement("span");
  info.className = "kachel-info";
  info.textContent = [
    teil.art ? nameVon(ACCESSOIRE_ARTEN, teil.art) : nameVon(KATEGORIEN, teil.kategorie),
    nameVon(WAERME, teil.waerme),
    teil.regenfest ? "regenfest" : null,
  ].filter(Boolean).join(" · ");

  kachel.append(fotoBild(bilder.neu(teil.vorschau), teil.name), name, info);
  return kachel;
}
