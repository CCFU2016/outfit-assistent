// teil-formular.js – ein Kleidungsstück anlegen, bearbeiten oder löschen

import { teilLaden, teilSpeichern, teilLoeschen, neueId, bitteUmDauerhaftenSpeicher } from "./speicher.js";
import { verkleinereFoto, bereiteAusschnittVor } from "./fotos.js";
import { KATEGORIEN, ACCESSOIRE_ARTEN, WAERME, FARBEN, ANLAESSE } from "./daten.js";
import { kiVorhanden, kiBereit, erkenne } from "./ki.js";

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
const formularBereich = document.getElementById("formular");
const ausschnittBild = document.getElementById("ausschnitt-vorschau");
const ausschnittLeer = document.getElementById("ausschnitt-leer");
const knopfEinsetzen = document.getElementById("knopf-einsetzen");
const ausschnittDatei = document.getElementById("ausschnitt-datei");
const knopfAusschnittWeg = document.getElementById("knopf-ausschnitt-weg");
const ausschnittStatus = document.getElementById("ausschnitt-status");

let bisherigesTeil = null; // beim Bearbeiten: das Teil, wie es gespeichert ist
let neueFotos = null;      // nach der Fotoauswahl: { foto, vorschau }
let fotoAdresse = null;    // Adresse für die Foto-Vorschau im Formular
let erkennungNr = 0;       // zählt mit, damit eine alte, verspätete Antwort nichts mehr einträgt
let neuerAusschnitt;       // für die Puppe: undefined = unverändert, null = entfernt, sonst das neue Bild
let ausschnittAdresse = null;

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
  neuerAusschnitt = undefined;
  zeigeAusschnitt(bisherigesTeil?.ausgeschnitten || null);
  zeigeAusschnittStatus("");
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
  if (!(await kiBereit())) {
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

// ---------- Für die Puppe: das ausgeschnittene Bild (die Arbeit macht fotos.js) ----------
// „Einsetzen“ holt das Bild aus der Zwischenablage (nach „Kopieren“ / „Motiv kopieren“ auf dem iPhone)
knopfEinsetzen.hidden = !navigator.clipboard?.read;
knopfEinsetzen.addEventListener("click", async () => {
  try {
    for (const eintrag of await navigator.clipboard.read()) {
      const typ = eintrag.types.find((art) => art.startsWith("image/"));
      if (typ) return await uebernimmAusschnitt(await eintrag.getType(typ));
    }
    zeigeAusschnittStatus("In der Zwischenablage ist kein Bild. Kopier zuerst das ausgeschnittene Stück (siehe „So geht's“).", true);
  } catch (fehler) {
    console.warn(fehler);
    zeigeAusschnittStatus("Einsetzen hat nicht geklappt. Tippe noch einmal auf „Einsetzen“ und bestätige mit „Einsetzen“.", true);
  }
});

ausschnittDatei.addEventListener("change", async () => {
  const datei = ausschnittDatei.files[0];
  ausschnittDatei.value = "";
  if (datei) await uebernimmAusschnitt(datei);
});

// Am Computer oder mit Tastatur geht auch Einfügen (⌘V / Strg+V), solange das Formular offen ist
window.addEventListener("paste", (ereignis) => {
  if (formularBereich.hidden) return;
  const datei = [...(ereignis.clipboardData?.files || [])].find((eintrag) => eintrag.type.startsWith("image/"));
  if (!datei) return; // z. B. Text in das Namensfeld einfügen: ganz normal
  ereignis.preventDefault();
  uebernimmAusschnitt(datei);
});

knopfAusschnittWeg.addEventListener("click", () => {
  neuerAusschnitt = null;
  zeigeAusschnitt(null);
  zeigeAusschnittStatus("Entfernt. Vergiss nicht zu speichern.");
});

async function uebernimmAusschnitt(datei) {
  zeigeAusschnittStatus("Einen Moment …");
  try {
    neuerAusschnitt = await bereiteAusschnittVor(datei);
    zeigeAusschnitt(neuerAusschnitt);
    zeigeAusschnittStatus("Eingesetzt! Vergiss nicht zu speichern.");
  } catch (fehler) {
    console.warn(fehler);
    zeigeAusschnittStatus(fehler.message.startsWith("Auf diesem Bild") ? fehler.message : "Dieses Bild ging leider nicht.", true);
  }
}

function zeigeAusschnitt(bild) {
  if (ausschnittAdresse) URL.revokeObjectURL(ausschnittAdresse);
  ausschnittAdresse = bild ? URL.createObjectURL(bild) : null;
  ausschnittBild.hidden = !bild;
  ausschnittLeer.hidden = Boolean(bild);
  knopfAusschnittWeg.hidden = !bild;
  if (bild) ausschnittBild.src = ausschnittAdresse;
  else ausschnittBild.removeAttribute("src");
}

function zeigeAusschnittStatus(text, istFehler = false) {
  ausschnittStatus.textContent = text;
  ausschnittStatus.hidden = !text;
  ausschnittStatus.classList.toggle("ki-fehler", istFehler);
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
  if (neuerAusschnitt !== undefined) {
    teil.ausgeschnitten = neuerAusschnitt;
    teil.puppe = null; // neues Bild: den Platz auf der Puppe neu bestimmen
  }

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
