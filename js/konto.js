// konto.js – anmelden, Konto anlegen, abmelden
//
// Nach dem Anmelden schickt der Server einen Anmelde-Schlüssel (Token).
// Den speichern wir auf dem Gerät (über speicher.js). Damit bleibt man angemeldet,
// auch ohne Internet. Das Passwort selbst wird nie auf dem Gerät gespeichert.

import { einstellungLesen, einstellungSpeichern } from "./speicher.js";
import { frageServer } from "./verbindung.js";

// Schalter: Muss man sich anmelden, bevor man die App benutzen kann?
// Eingeschaltet, seit die Datenbank beim Server läuft und Veras Konto angelegt ist.
// Wer einmal angemeldet ist, bleibt es auf dem Gerät, auch ohne Internet.
export const ANMELDUNG_PFLICHT = true;

// Ist die Anmeldung beim Server eingerichtet (gibt es die Datenbank)? Einmal pro Start gefragt.
let moeglich = null;
export function anmeldungMoeglich() {
  moeglich ??= frageServer("/", { methode: "GET" }).then((antwort) => antwort.anmeldung === true, () => false);
  return moeglich;
}

// { token, email } oder null, wenn niemand angemeldet ist
export async function sitzung() {
  return (await einstellungLesen("sitzung")) || null;
}

// Für Anfragen an den Server: "Authorization: Bearer …", wenn jemand angemeldet ist
export async function anmeldeKopf() {
  const aktuell = await sitzung();
  return aktuell ? { Authorization: `Bearer ${aktuell.token}` } : {};
}

export async function anmelden(email, passwort) {
  const antwort = await frageServer("/konto/anmelden", { inhalt: { email, passwort } });
  await einstellungSpeichern("sitzung", { token: antwort.token, email: antwort.email });
  return antwort.email;
}

export async function registrieren(email, passwort, einladungscode) {
  const antwort = await frageServer("/konto/registrieren", { inhalt: { email, passwort, einladungscode } });
  await einstellungSpeichern("sitzung", { token: antwort.token, email: antwort.email });
  return antwort.email;
}

// Abmelden: beim Server (wenn er erreichbar ist) und auf dem Gerät.
// Die Stücke auf dem Gerät bleiben erhalten.
export async function abmelden() {
  const kopf = await anmeldeKopf();
  try {
    await frageServer("/konto/abmelden", { kopf });
  } catch {
    // Kein Internet? Dann vergisst wenigstens das Gerät die Anmeldung.
  }
  await sitzungVergessen();
}

// Der Server kennt den Anmelde-Schlüssel nicht mehr (z. B. nach langer Zeit): neu anmelden
export function sitzungVergessen() {
  return einstellungSpeichern("sitzung", null);
}
