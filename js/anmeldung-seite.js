// anmeldung-seite.js – der Bildschirm „Anmelden“ / „Konto anlegen“
// Die Arbeit mit dem Server macht konto.js.

import { anmelden, registrieren, istGast, gastStarten, ANMELDUNG_PFLICHT } from "./konto.js";
import { abgleichen } from "./cloud.js";

const formular = document.getElementById("anmeldung-formular");
const titel = document.getElementById("titel-anmeldung");
const feldEmail = document.getElementById("anmeldung-email");
const feldPasswort = document.getElementById("anmeldung-passwort");
const passwortHinweis = document.getElementById("anmeldung-passwort-hinweis");
const feldEinladung = document.getElementById("feld-einladung");
const eingabeEinladung = document.getElementById("anmeldung-einladung");
const meldung = document.getElementById("anmeldung-meldung");
const knopf = document.getElementById("anmeldung-knopf");
const frage = document.getElementById("anmeldung-frage");
const wechsel = document.getElementById("anmeldung-wechsel");
const zurueck = document.getElementById("anmeldung-zurueck");
const gastBereich = document.getElementById("gast-bereich");
const knopfGast = document.getElementById("knopf-gast");

let neuesKonto = false; // false = Anmelden, true = Konto anlegen

export async function zeigeAnmeldung() {
  meldung.hidden = true;
  const gast = await istGast();
  // Wenn man sich anmelden MUSS, gibt es kein „Zurück“ (außer man probiert die App schon als Gast aus)
  zurueck.parentElement.hidden = ANMELDUNG_PFLICHT && !gast;
  gastBereich.hidden = gast;
  stelleEin();
}

// Ohne Konto ausprobieren: zur Garderobe, alles bleibt auf diesem Gerät
knopfGast.addEventListener("click", async () => {
  await gastStarten();
  if (location.hash === "#kleiderschrank") window.dispatchEvent(new Event("anmeldung-geaendert"));
  else location.hash = "#kleiderschrank";
});

function stelleEin() {
  titel.textContent = neuesKonto ? "Konto anlegen" : "Anmelden";
  knopf.textContent = neuesKonto ? "Konto anlegen" : "Anmelden";
  frage.textContent = neuesKonto ? "Schon ein Konto?" : "Noch kein Konto?";
  wechsel.textContent = neuesKonto ? "Anmelden" : "Konto anlegen";
  feldEinladung.hidden = !neuesKonto;
  passwortHinweis.hidden = !neuesKonto;
  // Damit der Passwort-Manager vom iPhone richtig hilft: neues Passwort vorschlagen oder gespeichertes einsetzen
  feldPasswort.autocomplete = neuesKonto ? "new-password" : "current-password";
}

wechsel.addEventListener("click", () => {
  neuesKonto = !neuesKonto;
  meldung.hidden = true;
  stelleEin();
});

formular.addEventListener("input", () => {
  meldung.hidden = true;
});

formular.addEventListener("submit", async (ereignis) => {
  ereignis.preventDefault();
  const email = feldEmail.value.trim();
  const passwort = feldPasswort.value;

  const fehlt = [];
  if (!email) fehlt.push("E-Mail");
  if (!passwort) fehlt.push("Passwort");
  if (neuesKonto && !eingabeEinladung.value.trim()) fehlt.push("Einladungscode");
  if (fehlt.length) return zeigeMeldung(`Bitte noch ausfüllen: ${fehlt.join(", ")}`);
  if (neuesKonto && passwort.length < 8) return zeigeMeldung("Das Passwort braucht mindestens 8 Zeichen.");

  knopf.disabled = true;
  knopf.textContent = neuesKonto ? "Konto wird angelegt …" : "Einen Moment …";
  try {
    if (neuesKonto) await registrieren(email, passwort, eingabeEinladung.value.trim());
    else await anmelden(email, passwort);
    formular.reset();
    neuesKonto = false;
    // Zur Garderobe. Steht die Adresse schon auf #kleiderschrank, merkt der Browser keinen Wechsel: dann Bescheid sagen
    if (location.hash === "#kleiderschrank") window.dispatchEvent(new Event("anmeldung-geaendert"));
    else location.hash = "#kleiderschrank";
    abgleichen().catch(() => {}); // Stücke aus der Cloud holen und die von hier hochladen
  } catch (fehler) {
    zeigeMeldung(fehler.message);
  } finally {
    knopf.disabled = false;
    stelleEin();
  }
});

function zeigeMeldung(text) {
  meldung.textContent = text;
  meldung.hidden = false;
}
