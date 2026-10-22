// verbindung.js – mit unserem Server bei Railway sprechen (Anmeldung und KI-Erkennung)
// Hier steht die Adresse des Servers und wie Fehler in verständliche Sätze übersetzt werden.

// Adresse des Servers bei Railway. Leer = es gibt (noch) keinen Server: keine KI, keine Anmeldung.
export const SERVER_ADRESSE = "https://outfit-assistent-production.up.railway.app";

const WARTEN_MS = 30 * 1000; // so lange warten wir höchstens auf eine Antwort

// Fragt den Server. Ergebnis: die Antwort als Objekt.
// Bei einem Problem: ein Fehler mit verständlichem Text (fehler.message) und dem Status (fehler.status, 0 = keine Antwort).
export async function frageServer(pfad, { methode = "POST", inhalt, kopf = {} } = {}) {
  const abbruch = new AbortController();
  const wecker = setTimeout(() => abbruch.abort(), WARTEN_MS);
  let antwort;
  try {
    antwort = await fetch(SERVER_ADRESSE.replace(/\/$/, "") + pfad, {
      method: methode,
      headers: { ...(inhalt ? { "Content-Type": "application/json" } : {}), ...kopf },
      body: inhalt ? JSON.stringify(inhalt) : undefined,
      signal: abbruch.signal,
    });
  } catch {
    // Der Browser verrät nicht genau, warum es nicht geklappt hat. Ob das Gerät online ist, wissen wir aber.
    if (abbruch.signal.aborted) throw fehlerMit(0, "Der Server hat zu lange gebraucht. Versuch es gleich noch einmal.");
    if (navigator.onLine === false) throw fehlerMit(0, "Du bist gerade offline. Dafür brauchst du Internet.");
    throw fehlerMit(0, "Der Server antwortet nicht. An deinem Internet liegt es wahrscheinlich nicht. Sag bitte einem Erwachsenen Bescheid.");
  } finally {
    clearTimeout(wecker);
  }
  const daten = await antwort.json().catch(() => ({}));
  if (!antwort.ok) throw fehlerMit(antwort.status, daten.fehler || "Das hat leider nicht geklappt.");
  return daten;
}

function fehlerMit(status, text) {
  return Object.assign(new Error(text), { status });
}
