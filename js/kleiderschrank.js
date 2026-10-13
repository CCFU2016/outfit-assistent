// kleiderschrank.js – zeigt alle Kleidungsstücke als Bilder

import { alleTeile } from "./speicher.js";
import { KATEGORIEN, WAERME, nameVon } from "./daten.js";

let bildAdressen = []; // Adressen der angezeigten Bilder (werden beim Neuzeichnen freigegeben)

export async function zeigeKleiderschrank() {
  const teile = await alleTeile();
  teile.sort((a, b) => b.erstelltAm.localeCompare(a.erstelltAm)); // neueste zuerst

  // Alte Bild-Adressen freigeben, damit der Speicher nicht vollläuft
  for (const adresse of bildAdressen) URL.revokeObjectURL(adresse);
  bildAdressen = [];

  document.getElementById("teile-liste").replaceChildren(...teile.map(baueKachel));
  document.getElementById("kleiderschrank-leer").hidden = teile.length > 0;
  document.getElementById("teile-anzahl").textContent =
    teile.length === 1 ? "1 Teil" : teile.length > 1 ? `${teile.length} Teile` : "";
}

// Eine Kachel: Foto, Name und eine kurze Beschreibung. Antippen öffnet das Teil.
function baueKachel(teil) {
  const adresse = URL.createObjectURL(teil.vorschau);
  bildAdressen.push(adresse);

  const kachel = document.createElement("a");
  kachel.className = "kachel";
  kachel.href = `#teil/${teil.id}`;

  const bild = document.createElement("img");
  bild.className = "foto";
  bild.src = adresse;
  bild.alt = teil.name;
  bild.decoding = "async";

  const name = document.createElement("span");
  name.className = "kachel-name";
  name.textContent = teil.name;

  const info = document.createElement("span");
  info.className = "kachel-info";
  info.textContent = [
    nameVon(KATEGORIEN, teil.kategorie),
    nameVon(WAERME, teil.waerme),
    teil.regenfest ? "regenfest" : null,
  ].filter(Boolean).join(" · ");

  kachel.append(bild, name, info);
  return kachel;
}
