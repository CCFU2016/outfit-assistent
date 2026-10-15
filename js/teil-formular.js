// teil-formular.js – ein Kleidungsstück anlegen, bearbeiten oder löschen

import { teilLaden, teilSpeichern, teilLoeschen, neueId, bitteUmDauerhaftenSpeicher } from "./speicher.js";
import { verkleinereFoto } from "./fotos.js";
import { KATEGORIEN, ACCESSOIRE_ARTEN, WAERME, FARBEN, ANLAESSE } from "./daten.js";
import { kiVorhanden, zugangscode, erkenne } from "./ki.js";

const formular = document.getElementById("teil-formular");
const titel = document.getElementById("formular-titel");
const fotoBild = document.getElementById("foto-vorschau");
const fotoPlatzhalter = document.getElementById("foto-platzhalter");
const fotoPlatzhalterText = document.getElementById("foto-platzhalter-text");
const feldName = document.getElementById("feld-name");
const feldRegenfest = document.getElementById("feld-regenfest");
const meldung = document.getElementById("formular-meldung");
const knopfSpeichern = document.getElementById("knopf-speichern");
const knopfLoeschen = document.getElementById("knopf-loeschen");
const feldArt = document.getElementById("feld-art");
const knopfErkennen = document.getElementById("knopf-erkennen");
const kiStatus = document.getElementById("ki-status");

let bisherigesTeil = null; // beim Bearbeiten: das Teil, wie es gespeichert ist
let neueFotos = null;      // nach der Fotoauswahl: { foto, vorschau }
let fotoAdresse = null;    // Adresse für die Foto-Vorschau im Formular
let erkennungNr = 0;       // zählt mit, damit eine alte, verspätete Antwort nichts mehr einträgt

// ---------- Die Auswahl-Knöpfe aus den Listen in daten.js bauen ----------
baueAuswahl("auswahl-kategorie", "kategorie", "radio", KATEGORIEN);
baueAuswahl("auswahl-art", "art", "radio", ACCESSOIRE_ARTEN);
baueAuswahl("auswahl-waerme", "waerme", "radio", WAERME);
baueAuswahl("auswahl-farbe", "farbe", "radio", FARBEN);
baueAuswahl("auswahl-anlaesse", "anlaesse", "checkbox", ANLAESSE);

// typ "radio" = genau eine Auswahl, "checkbox" = mehrere möglich
function baueAuswahl(behaelterId, feld, typ, liste) {
  const behaelter = document.getElementById(behaelterId);
  for (const eintrag of liste) {
    const eingabe = document.createElement("input");
    eingabe.type = typ;
    eingabe.name = feld;
    eingabe.value = eintrag.wert;

    const text = document.createElement("span");
    if (eintrag.farbe) {
      const punkt = document.createElement("i");
      punkt.className = "farbpunkt";
      punkt.style.setProperty("--farbe", eintrag.farbe);
      text.append(punkt);
    }
    text.append(eintrag.name);
    if (eintrag.hinweis) {
      const hinweis = document.createElement("small");
      hinweis.textContent = eintrag.hinweis;
      text.append(hinweis);
    }

    const chip = document.createElement("label");
    chip.className = "chip";
    chip.append(eingabe, text);
    behaelter.append(chip);
  }
}

// ---------- Formular öffnen (leer oder mit einem gespeicherten Teil) ----------
export async function zeigeFormular(id) {
  formular.reset();
  neueFotos = null;
  versteckeMeldung();
  erkennungNr++;
  zeigeKiStatus("");

  bisherigesTeil = id ? await teilLaden(id) : null;
  if (id && !bisherigesTeil) {
    location.hash = "#kleiderschrank"; // dieses Teil gibt es nicht (mehr)
    return;
  }

  titel.textContent = bisherigesTeil ? "Stück bearbeiten" : "Neues Stück";
  knopfLoeschen.hidden = !bisherigesTeil;

  if (bisherigesTeil) {
    feldName.value = bisherigesTeil.name;
    feldRegenfest.checked = bisherigesTeil.regenfest;
    waehleAus("kategorie", bisherigesTeil.kategorie);
    waehleAus("waerme", bisherigesTeil.waerme);
    waehleAus("farbe", bisherigesTeil.farbe);
    for (const anlass of bisherigesTeil.anlaesse) waehleAus("anlaesse", anlass);
    if (bisherigesTeil.art) waehleAus("art", bisherigesTeil.art);
  }
  zeigeArtFeld();
  zeigeFoto(bisherigesTeil ? bisherigesTeil.foto : null);
  knopfErkennen.hidden = !kiVorhanden() || !bisherigesTeil;
}

// "Art" gibt es nur bei Accessoires
function zeigeArtFeld() {
  feldArt.hidden = gewaehlt("kategorie") !== "accessoire";
}
formular.addEventListener("change", (ereignis) => {
  if (ereignis.target.name === "kategorie") zeigeArtFeld();
});

function waehleAus(feld, wert) {
  const eingabe = formular.querySelector(`input[name="${feld}"][value="${wert}"]`);
  if (eingabe) eingabe.checked = true;
}

function gewaehlt(feld) {
  const eingabe = formular.querySelector(`input[name="${feld}"]:checked`);
  return eingabe ? eingabe.value : "";
}

// ---------- Foto aufnehmen oder aus der Galerie wählen ----------
for (const eingabe of document.querySelectorAll(".foto-eingabe")) {
  eingabe.addEventListener("change", async () => {
    const datei = eingabe.files[0];
    eingabe.value = ""; // damit man dasselbe Foto noch einmal wählen kann
    if (!datei) return;

    zeigeFoto(null);
    fotoPlatzhalterText.textContent = "Foto wird vorbereitet …";
    try {
      neueFotos = await verkleinereFoto(datei);
      zeigeFoto(neueFotos.foto);
      await nachDemFoto();
    } catch (fehler) {
      console.error(fehler);
      fotoPlatzhalterText.textContent = "Dieses Foto ging leider nicht. Probier ein anderes.";
    }
  });
}

function zeigeFoto(bild) {
  if (fotoAdresse) URL.revokeObjectURL(fotoAdresse);
  fotoAdresse = bild ? URL.createObjectURL(bild) : null;

  fotoBild.hidden = !bild;
  fotoBild.parentElement.classList.toggle("hat-foto", Boolean(bild));
  fotoPlatzhalter.hidden = Boolean(bild);
  fotoPlatzhalterText.textContent = "Noch kein Foto";
  if (bild) fotoBild.src = fotoAdresse;
  else fotoBild.removeAttribute("src");
}

// ---------- Automatisch erkennen (KI, siehe ki.js) ----------
// Nach einem neuen Foto: bei einem neuen Stück gleich erkennen lassen,
// beim Bearbeiten nur den Knopf zeigen (damit nichts ungefragt überschrieben wird).
async function nachDemFoto() {
  if (!kiVorhanden()) return;
  knopfErkennen.hidden = false;
  if (!(await zugangscode())) {
    zeigeKiStatus("Tipp: Richte unten in der Garderobe „Automatisch erkennen“ ein, dann füllt Claude das Formular für dich aus.");
  } else if (!bisherigesTeil) {
    await starteErkennung(false);
  }
}

knopfErkennen.addEventListener("click", () => starteErkennung(true));

// allesUeberschreiben: true beim Antippen des Knopfs; sonst bleibt ein schon getippter Name stehen
async function starteErkennung(allesUeberschreiben) {
  const bild = neueFotos ? neueFotos.vorschau : bisherigesTeil?.vorschau;
  if (!bild) return;
  const nummer = ++erkennungNr;
  knopfErkennen.disabled = true;
  zeigeKiStatus("Claude schaut sich dein Stück an …");
  try {
    const ergebnis = await erkenne(bild);
    if (nummer !== erkennungNr) return; // inzwischen anderes Foto oder Formular verlassen
    if (!ergebnis.istKleidung) {
      zeigeKiStatus("Auf dem Foto erkenne ich kein Kleidungsstück. Trag die Angaben bitte selbst ein.");
      return;
    }
    trageEin(ergebnis, allesUeberschreiben);
    zeigeKiStatus(`Erkannt: ${ergebnis.name}. Prüf kurz, ob alles stimmt. Du kannst alles ändern.`);
  } catch (fehler) {
    if (nummer === erkennungNr) zeigeKiStatus(fehler.message, true);
  } finally {
    if (nummer === erkennungNr) knopfErkennen.disabled = false;
  }
}

function trageEin(ergebnis, allesUeberschreiben) {
  waehleAus("kategorie", ergebnis.kategorie);
  if (ergebnis.art) waehleAus("art", ergebnis.art);
  waehleAus("farbe", ergebnis.farbe);
  waehleAus("waerme", ergebnis.waerme);
  feldRegenfest.checked = ergebnis.regenfest;
  if (allesUeberschreiben || !feldName.value.trim()) feldName.value = ergebnis.name.slice(0, 40);
  zeigeArtFeld();
  versteckeMeldung();
}

function zeigeKiStatus(text, istFehler = false) {
  kiStatus.textContent = text;
  kiStatus.hidden = !text;
  kiStatus.classList.toggle("ki-fehler", istFehler);
}

// ---------- Speichern ----------
formular.addEventListener("submit", async (ereignis) => {
  ereignis.preventDefault(); // die Seite soll nicht neu laden

  const eingaben = {
    name: feldName.value.trim(),
    kategorie: gewaehlt("kategorie"),
    waerme: gewaehlt("waerme"),
    regenfest: feldRegenfest.checked,
    farbe: gewaehlt("farbe"),
    art: gewaehlt("kategorie") === "accessoire" ? gewaehlt("art") : null,
    anlaesse: [...formular.querySelectorAll('input[name="anlaesse"]:checked')].map((e) => e.value),
  };

  // Fehlt noch etwas?
  const fehlt = [];
  if (!neueFotos && !bisherigesTeil) fehlt.push("Foto");
  if (!eingaben.name) fehlt.push("Name");
  if (!eingaben.kategorie) fehlt.push("Kategorie");
  if (eingaben.kategorie === "accessoire" && !eingaben.art) fehlt.push("Art des Accessoires");
  if (!eingaben.waerme) fehlt.push("Wärme");
  if (!eingaben.farbe) fehlt.push("Farbe");
  if (fehlt.length > 0) {
    zeigeMeldung(`Bitte noch ausfüllen: ${fehlt.join(", ")}`);
    return;
  }

  const jetzt = new Date().toISOString();
  const teil = {
    ...bisherigesTeil, // beim Bearbeiten: alles Bisherige behalten (z. B. das Foto)
    ...eingaben,
    ...neueFotos,      // nur wenn ein neues Foto gewählt wurde
    id: bisherigesTeil ? bisherigesTeil.id : neueId(),
    erstelltAm: bisherigesTeil ? bisherigesTeil.erstelltAm : jetzt,
    geaendertAm: jetzt,
  };

  knopfSpeichern.disabled = true;
  try {
    await teilSpeichern(teil);
    bitteUmDauerhaftenSpeicher();
    location.hash = "#kleiderschrank";
  } catch (fehler) {
    console.error(fehler);
    zeigeMeldung("Speichern hat nicht geklappt. Ist der Speicher auf dem Handy voll?");
  } finally {
    knopfSpeichern.disabled = false;
  }
});

// ---------- Löschen ----------
knopfLoeschen.addEventListener("click", async () => {
  if (!bisherigesTeil) return;
  if (!confirm(`„${bisherigesTeil.name}“ wirklich löschen?`)) return;
  await teilLoeschen(bisherigesTeil.id);
  location.hash = "#kleiderschrank";
});

// ---------- Meldungen ----------
// Sobald man etwas ändert, verschwindet die alte Meldung
formular.addEventListener("input", versteckeMeldung);

function zeigeMeldung(text) {
  meldung.textContent = text;
  meldung.hidden = false;
  meldung.scrollIntoView({ behavior: "smooth", block: "center" });
}

function versteckeMeldung() {
  meldung.hidden = true;
}
