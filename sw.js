// sw.js – der Service Worker
// Er läuft im Hintergrund und legt die App-Dateien auf dem Gerät ab.
// So startet die App schnell und funktioniert auch ohne Internet.

const SPEICHER_NAME = "outfit-assistent-v7";

// Diese Dateien braucht die App zum Starten
const APP_DATEIEN = [
  "./",
  "index.html",
  "css/style.css",
  "js/app.js",
  "js/daten.js",
  "js/speicher.js",
  "js/fotos.js",
  "js/kleiderschrank.js",
  "js/teil-formular.js",
  "js/bilder.js",
  "js/outfit.js",
  "js/wetter.js",
  "js/ort-auswahl.js",
  "js/vorschlag.js",
  "js/kombi.js",
  "js/wetter-seite.js",
  "manifest.webmanifest",
  "fonts/lobster-two-700-italic.woff2",
  "fonts/nunito-variabel.woff2",
  "icons/icon.svg",
  "icons/icon-192.png",
  "icons/apple-touch-icon.png",
];

// Beim ersten Öffnen: alle App-Dateien ablegen
self.addEventListener("install", (ereignis) => {
  ereignis.waitUntil(
    caches.open(SPEICHER_NAME).then((speicher) => speicher.addAll(APP_DATEIEN))
  );
  self.skipWaiting();
});

// Alte Ablagen von früheren Versionen aufräumen
self.addEventListener("activate", (ereignis) => {
  ereignis.waitUntil(
    caches.keys()
      .then((namen) => Promise.all(
        namen.filter((name) => name !== SPEICHER_NAME).map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

// Bei jeder Anfrage: "Internet zuerst"
// Mit Internet holt die App immer die neueste Version (und legt sie ab).
// Ohne Internet nimmt sie die abgelegte Version.
self.addEventListener("fetch", (ereignis) => {
  const anfrage = ereignis.request;
  const adresse = new URL(anfrage.url);

  // Nur eigene Dateien; fremde Seiten (z. B. der Wetterdienst) laufen ganz normal
  if (anfrage.method !== "GET" || adresse.origin !== self.location.origin) return;

  ereignis.respondWith(
    fetch(anfrage.url, { cache: "no-cache" })
      .then((antwort) => {
        if (antwort.ok) {
          const kopie = antwort.clone();
          caches.open(SPEICHER_NAME).then((speicher) => speicher.put(anfrage, kopie));
        }
        return antwort;
      })
      .catch(async () => {
        const abgelegt = await caches.match(anfrage, { ignoreSearch: true });
        // Beim Öffnen einer Seite ohne Internet: die Startseite zeigen
        return abgelegt || (anfrage.mode === "navigate" ? caches.match("./") : Response.error());
      })
  );
});
