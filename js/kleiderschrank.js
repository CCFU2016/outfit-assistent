// kleiderschrank.js – zeigt alle Kleidungsstücke als Bilder, nach Kategorie filterbar

import { alleTeile } from "./speicher.js";
import { KATEGORIEN, ACCESSOIRE_ARTEN, WAERME, nameVon } from "./daten.js";
import { bildAdressen, fotoBild } from "./bilder.js";
import { sicherungSpeichern, sicherungLesen, sicherungLaden, letzteSicherung } from "./sicherung.js";
import { kiVorhanden, zugangscode, zugangscodeSpeichern, codePruefen } from "./ki.js";
import { sitzung, abmelden, anmeldungMoeglich, ANMELDUNG_PFLICHT } from "./konto.js";
import { abgleichen, cloudZustand } from "./cloud.js";

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
  await zeichneSicherung();
  await zeichneKonto();
  await zeichneKi();
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

// ---------- Dein Konto und die Cloud (die Arbeit machen konto.js und cloud.js) ----------
const kontoKarte = document.getElementById("konto-karte");
const kontoStand = document.getElementById("konto-stand");
const cloudStand = document.getElementById("cloud-stand");
const knopfAbgleichen = document.getElementById("knopf-abgleichen");
const knopfZurAnmeldung = document.getElementById("knopf-zur-anmeldung");
const knopfAbmelden = document.getElementById("knopf-abmelden");

async function zeichneKonto() {
  const aktuell = await sitzung();
  cloudStand.hidden = knopfAbgleichen.hidden = !aktuell;
  if (aktuell) {
    kontoKarte.hidden = false;
    kontoStand.textContent = `Angemeldet als ${aktuell.email}`;
    zeichneCloud();
    knopfAbmelden.hidden = false;
    knopfZurAnmeldung.hidden = true;
    return;
  }
  // Nicht angemeldet: Die Karte erscheint erst, wenn der Server die Anmeldung anbietet
  const moeglich = await anmeldungMoeglich();
  kontoKarte.hidden = !moeglich;
  kontoStand.textContent = "Mit einem Konto ist deine Garderobe auf all deinen Geräten da.";
  knopfAbmelden.hidden = true;
  knopfZurAnmeldung.hidden = false;
}

// Zeigt, ob alles in der Cloud ist
function zeichneCloud() {
  const { laeuft, zuletzt, fehler } = cloudZustand();
  knopfAbgleichen.disabled = laeuft;
  if (laeuft) cloudStand.textContent = "Wird mit der Cloud abgeglichen …";
  else if (fehler) cloudStand.textContent = `Noch nicht abgeglichen: ${fehler}`;
  else if (zuletzt) cloudStand.textContent = `In der Cloud abgeglichen um ${uhrzeit(zuletzt)} Uhr.`;
  else cloudStand.textContent = "Noch nicht mit der Cloud abgeglichen.";
}

function uhrzeit(zeit) {
  return new Date(zeit).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

window.addEventListener("cloud-zustand", zeichneCloud);
knopfAbgleichen.addEventListener("click", () => abgleichen().catch(() => {}));

knopfAbmelden.addEventListener("click", async () => {
  const hinweis = ANMELDUNG_PFLICHT
    ? "Abmelden? Danach musst du dich neu anmelden, um die App zu benutzen. Deine Stücke bleiben auf diesem Gerät."
    : "Abmelden? Deine Stücke bleiben auf diesem Gerät.";
  if (!confirm(hinweis)) return;
  knopfAbmelden.disabled = true;
  await abmelden();
  knopfAbmelden.disabled = false;
  if (ANMELDUNG_PFLICHT) location.hash = "#anmeldung";
  else await zeigeKleiderschrank();
});

// ---------- Automatisch erkennen: Zugangscode einrichten (die Arbeit macht ki.js) ----------
const kiKarte = document.getElementById("ki-karte");
const kiStand = document.getElementById("ki-stand");
const kiFormular = document.getElementById("ki-formular");
const kiCode = document.getElementById("ki-code");
const kiMeldung = document.getElementById("ki-meldung");

async function zeichneKi() {
  // Wer angemeldet ist, braucht keinen Zugangscode mehr
  kiKarte.hidden = !kiVorhanden() || Boolean(await sitzung());
  if (kiKarte.hidden) return;
  kiStand.textContent = (await zugangscode()) ? "Eingerichtet ✓" : "Noch nicht eingerichtet: Tippe einmal den Zugangscode ein.";
}

kiFormular.addEventListener("submit", async (ereignis) => {
  ereignis.preventDefault();
  const code = kiCode.value.trim();
  if (!code) return;
  kiMeldung.hidden = true;
  kiStand.textContent = "Ich prüfe den Code …";
  try {
    const { uebrigHeute } = await codePruefen(code);
    await zugangscodeSpeichern(code);
    kiCode.value = "";
    kiStand.textContent = `Eingerichtet ✓ Heute noch ${uebrigHeute} Erkennungen.`;
  } catch (fehler) {
    kiMeldung.textContent = fehler.message.startsWith("Der Zugangscode") ? "Der Zugangscode stimmt nicht." : fehler.message;
    kiMeldung.hidden = false;
    await zeichneKi();
  }
});

// ---------- Sicherung speichern und laden (die Arbeit macht sicherung.js) ----------
const knopfSichern = document.getElementById("knopf-sichern");
const sicherungDatei = document.getElementById("sicherung-datei");
const sicherungStand = document.getElementById("sicherung-stand");
const sicherungStatus = document.getElementById("sicherung-status");
const sicherungFehler = document.getElementById("sicherung-fehler");
const sicherungTipp = document.getElementById("sicherung-tipp");

async function zeichneSicherung() {
  knopfSichern.hidden = teile.length === 0; // ohne Stücke gibt es nichts zu sichern
  sicherungTipp.hidden = teile.length === 0;
  const zuletzt = await letzteSicherung();
  sicherungStand.textContent = zuletzt
    ? `Zuletzt gesichert: ${new Date(zuletzt).toLocaleDateString("de-DE", { day: "numeric", month: "numeric", year: "numeric" })}`
    : teile.length ? "Noch nie gesichert." : "";
}

function zeigeSicherungStatus(text, istFehler = false) {
  sicherungStatus.hidden = istFehler || !text;
  sicherungFehler.hidden = !istFehler;
  (istFehler ? sicherungFehler : sicherungStatus).textContent = text;
}

knopfSichern.addEventListener("click", async () => {
  knopfSichern.disabled = true;
  zeigeSicherungStatus("Einen Moment, ich packe alles zusammen …");
  try {
    const ergebnis = await sicherungSpeichern();
    if (!ergebnis) {
      zeigeSicherungStatus(""); // im Teilen-Menü abgebrochen
    } else {
      const was = `${anzahlText(ergebnis.anzahlTeile, "Stück", "Stücke")} und ${anzahlText(ergebnis.anzahlLooks, "Look", "Looks")}`;
      zeigeSicherungStatus(ergebnis.geteilt
        ? `Fertig: ${was}. Prüf in der App „Dateien“, ob die Sicherung dort angekommen ist.`
        : `Fertig: ${was}. Die Datei ist im Ordner „Downloads“.`);
    }
  } catch (fehler) {
    console.error(fehler);
    zeigeSicherungStatus("Die Sicherung hat leider nicht geklappt. Versuch es bitte noch einmal.", true);
  } finally {
    knopfSichern.disabled = false;
    await zeichneSicherung();
  }
});

sicherungDatei.addEventListener("change", async () => {
  const datei = sicherungDatei.files[0];
  sicherungDatei.value = ""; // damit man dieselbe Datei noch einmal wählen kann
  if (!datei) return;

  try {
    const sicherung = await sicherungLesen(datei);
    const vom = sicherung.erstelltAm
      ? ` vom ${new Date(sicherung.erstelltAm).toLocaleDateString("de-DE", { day: "numeric", month: "numeric", year: "numeric" })}`
      : "";
    const was = `${anzahlText(sicherung.teile.length, "Stück", "Stücke")} und ${anzahlText(sicherung.getragen.length, "Look", "Looks")}`;
    if (!confirm(`Sicherung${vom} laden?\n\nDarin: ${was}.\nGleiche Stücke werden ersetzt. Es wird nichts gelöscht.`)) return;

    zeigeSicherungStatus("Einen Moment, ich lade die Sicherung …");
    await sicherungLaden(sicherung);
    zeigeSicherungStatus(`Sicherung geladen: ${was}.` +
      (sicherung.kaputt ? ` ${anzahlText(sicherung.kaputt, "Stück war", "Stücke waren")} beschädigt und fehlt.` : ""));
    await zeigeKleiderschrank();
  } catch (fehler) {
    console.error(fehler);
    zeigeSicherungStatus(fehler.message.startsWith("Das ist") || fehler.message.startsWith("Diese Sicherung")
      ? fehler.message
      : "Die Sicherung konnte nicht geladen werden. Ist der Speicher auf dem Handy voll?", true);
  }
});

// "1 Stück", "3 Stücke"
function anzahlText(anzahl, eins, mehrere) {
  return `${anzahl} ${anzahl === 1 ? eins : mehrere}`;
}
