// app.js – startet die App
// Hier steht, was passiert, wenn die App geöffnet wird:
// 1. die richtige Seite zeigen (Kleiderschrank, Outfit, Wetter oder das Formular)
// 2. auf dem Handy einen Tipp zum Installieren zeigen
// 3. den Service Worker anmelden (damit die App auch ohne Internet startet)

import { zeigeKleiderschrank } from "./kleiderschrank.js";
import { zeigeFormular } from "./teil-formular.js";

const VERSION = "0.3 (Kleidungsstück erfassen)";

const TABS = ["kleiderschrank", "outfit", "wetter"];

// ---------- 1. Die richtige Seite zeigen ----------
// Welche Seite offen ist, steht hinten in der Adresse:
//   #kleiderschrank, #outfit, #wetter  → die drei Bereiche der Leiste unten
//   #neues-teil                         → leeres Formular
//   #teil/3f2a…                         → Formular mit dem Teil, das diese Nummer hat
async function zeigeSeite() {
  const ziel = decodeURIComponent(location.hash.slice(1)); // "#outfit" → "outfit"
  const istFormular = ziel === "neues-teil" || ziel.startsWith("teil/");
  const bereich = istFormular ? "formular" : TABS.includes(ziel) ? ziel : "kleiderschrank";
  const tab = istFormular ? "kleiderschrank" : bereich;

  // Nur der passende Bereich ist sichtbar
  for (const abschnitt of document.querySelectorAll(".bereich")) {
    abschnitt.hidden = abschnitt.id !== bereich;
  }
  // Den passenden Eintrag in der Leiste unten hervorheben
  for (const eintrag of document.querySelectorAll(".tableiste a")) {
    if (eintrag.dataset.bereich === tab) eintrag.setAttribute("aria-current", "page");
    else eintrag.removeAttribute("aria-current");
  }
  // Beim Formular blenden wir die Leiste unten aus
  document.body.classList.toggle("formular-offen", istFormular);
  window.scrollTo(0, 0);

  try {
    if (bereich === "kleiderschrank") await zeigeKleiderschrank();
    if (istFormular) await zeigeFormular(ziel.startsWith("teil/") ? ziel.slice(5) : null);
    document.getElementById("app-fehler").hidden = true;
  } catch (fehler) {
    console.error(fehler);
    const anzeige = document.getElementById("app-fehler");
    anzeige.textContent = `Hoppla, da ist etwas schiefgegangen: ${fehler.message}`;
    anzeige.hidden = false;
  }
}

// ---------- 2. Tipp zum Installieren ----------
function istInstalliert() {
  // true, wenn die App vom Startbildschirm aus geöffnet wurde
  return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
}

function zeigeInstallierTipp() {
  if (istInstalliert()) return;

  const geraet = navigator.userAgent;
  const istAndroid = /Android/.test(geraet);
  // iPads geben sich manchmal als Mac aus, haben aber einen Touchscreen
  const istApple = !istAndroid && (/iPhone|iPad|iPod/.test(geraet + navigator.platform) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

  let text;
  if (istAndroid) {
    text = "Tippe in Chrome oben rechts auf ⋮ und dann auf „App installieren“ " +
      "oder „Zum Startbildschirm hinzufügen“.";
  } else if (istApple) {
    text = "Tippe in Safari auf „Teilen“ (Quadrat mit Pfeil nach oben; je nach iPhone steckt es " +
      "hinter „•••“ oder „≡“ neben der Adresse) und dann auf „Zum Home-Bildschirm“. " +
      "Trag deine Kleidung erst danach ein, in der App auf dem Startbildschirm: " +
      "Safari und die App haben getrennte Speicher.";
  } else {
    return; // Am Computer zeigen wir keinen Tipp
  }

  document.getElementById("installieren-text").textContent = text;
  document.getElementById("installieren").hidden = false;
  document.getElementById("installieren-spaeter").addEventListener("click", () => {
    document.getElementById("installieren").hidden = true;
  });
}

// ---------- 3. Service Worker anmelden ----------
// Funktioniert nur über HTTPS (oder auf dem eigenen Computer)
function meldeServiceWorkerAn() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch((fehler) => {
      console.warn("Service Worker konnte nicht starten:", fehler);
    });
  }
}

// ---------- Los geht's ----------
document.getElementById("version").textContent = VERSION;
window.addEventListener("hashchange", zeigeSeite);
zeigeSeite();
zeigeInstallierTipp();
meldeServiceWorkerAn();
