// wetter.js – Ort und Wetter
// Das Wetter kommt von Open-Meteo: kostenlos und ohne Schlüssel.
// Der Ort wird auf dem Gerät gespeichert, damit die App nicht jedes Mal fragen muss.

import { einstellungLesen, einstellungSpeichern } from "./speicher.js";

const WETTER_ADRESSE = "https://api.open-meteo.com/v1/forecast";
const STADT_SUCHE_ADRESSE = "https://geocoding-api.open-meteo.com/v1/search";

// Ab wann zählt ein Tag als Regentag?
const REGEN_AB_MM = 1;        // mindestens 1 mm Regen am Tag …
const REGEN_AB_PROZENT = 60;  // … oder eine Regenwahrscheinlichkeit ab 60 %

// ---------- Ort ----------
// Ein Ort sieht so aus: { name: "Berlin", breite: 52.52, laenge: 13.41 }
// (Breite und Länge sind die Koordinaten auf der Erde.)

export function gespeicherterOrt() {
  return einstellungLesen("ort");
}

export function ortSpeichern(ort) {
  return einstellungSpeichern("ort", ort);
}

// Den Standort des Handys abfragen. Das Handy fragt dabei um Erlaubnis.
export function standortAbfragen() {
  return new Promise((fertig, fehler) => {
    if (!navigator.geolocation) {
      fehler(new Error("Dieses Gerät kann keinen Standort bestimmen."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => fertig({
        name: "Dein Standort",
        // Auf 2 Stellen gerundet (etwa 1 km genau): reicht fürs Wetter und schützt deine Privatsphäre
        breite: runde(position.coords.latitude),
        laenge: runde(position.coords.longitude),
      }),
      (problem) => fehler(problem),
      { timeout: 15000, maximumAge: 60 * 60 * 1000 }
    );
  });
}

function runde(zahl) {
  return Math.round(zahl * 100) / 100;
}

// Städte mit diesem Namen suchen (höchstens 5 Treffer)
export async function stadtSuchen(text) {
  const parameter = new URLSearchParams({ name: text, count: "5", language: "de", format: "json" });
  const antwort = await fetch(`${STADT_SUCHE_ADRESSE}?${parameter}`);
  if (!antwort.ok) throw new Error("Die Stadtsuche ist gerade nicht erreichbar.");
  const daten = await antwort.json();
  return (daten.results || []).map((treffer) => ({
    name: treffer.name,
    gegend: [treffer.admin1, treffer.country].filter(Boolean).join(", "),
    breite: runde(treffer.latitude),
    laenge: runde(treffer.longitude),
  }));
}

// ---------- Wetter ----------
// Holt das Wetter für heute und morgen: { heute: {…}, morgen: {…} }
export async function wetterHolen(ort) {
  const parameter = new URLSearchParams({
    latitude: ort.breite,
    longitude: ort.laenge,
    daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max",
    timezone: "auto",
    forecast_days: "2",
  });
  const antwort = await fetch(`${WETTER_ADRESSE}?${parameter}`);
  if (!antwort.ok) throw new Error("Der Wetterdienst ist gerade nicht erreichbar.");
  const tage = (await antwort.json()).daily;

  function tag(nummer) {
    const regenMm = tage.precipitation_sum[nummer] ?? 0;
    const regenProzent = tage.precipitation_probability_max[nummer] ?? 0;
    return {
      datum: tage.time[nummer],
      tempMax: Math.round(tage.temperature_2m_max[nummer]),
      tempMin: Math.round(tage.temperature_2m_min[nummer]),
      regen: regenMm >= REGEN_AB_MM || regenProzent >= REGEN_AB_PROZENT,
      regenMm,
      regenProzent,
      ort: ort.name,
    };
  }
  return { heute: tag(0), morgen: tag(1) };
}

// Kurzer Text, z. B. "14 °C, Regen"
export function wetterText(wetter) {
  return `${wetter.tempMax} °C, ${wetter.regen ? "Regen" : "trocken"}`;
}
