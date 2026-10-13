// app.js – startet die App
// Hier steht, was passiert, wenn die App geöffnet wird:
// 1. den richtigen Bereich zeigen (Kleiderschrank, Outfit oder Wetter)
// 2. auf dem Handy einen Tipp zum Installieren zeigen
// 3. den Service Worker anmelden (damit die App auch ohne Internet startet)

const VERSION = "0.2 (Grundgerüst, hellere Farben)";

const BEREICHE = ["kleiderschrank", "outfit", "wetter"];

// ---------- 1. Zwischen den Bereichen wechseln ----------
// Welcher Bereich offen ist, steht hinten in der Adresse, z. B. ...#outfit
function zeigeBereich() {
  const gewuenscht = location.hash.slice(1); // "#outfit" → "outfit"
  const offen = BEREICHE.includes(gewuenscht) ? gewuenscht : "kleiderschrank";

  for (const name of BEREICHE) {
    // Nur der offene Bereich ist sichtbar
    document.getElementById(name).hidden = name !== offen;

    // Den passenden Eintrag in der Leiste unten hervorheben
    const eintrag = document.querySelector(`[data-bereich="${name}"]`);
    if (name === offen) {
      eintrag.setAttribute("aria-current", "page");
    } else {
      eintrag.removeAttribute("aria-current");
    }
  }
  window.scrollTo(0, 0);
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
  // iPads geben sich als Mac aus, haben aber einen Touchscreen
  const istApple = !istAndroid && (/iPhone|iPad|iPod/.test(geraet) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

  let text;
  if (istAndroid) {
    text = "Tippe in Chrome oben rechts auf ⋮ und dann auf „App installieren“ " +
      "oder „Zum Startbildschirm hinzufügen“.";
  } else if (istApple) {
    text = "Öffne die Seite in Safari, tippe auf das Teilen-Symbol (Quadrat mit Pfeil nach oben, " +
      "bei neueren iPhones zuerst auf „•••“) und dann auf „Zum Home-Bildschirm“. " +
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
window.addEventListener("hashchange", zeigeBereich);
zeigeBereich();
zeigeInstallierTipp();
meldeServiceWorkerAn();
