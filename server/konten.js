// konten.js – Konto anlegen, anmelden, abmelden
//
// Sicherheit:
//   - Passwörter werden nie gespeichert, nur ein "Fingerabdruck" (scrypt mit Salz).
//     Selbst wer die Datenbank sieht, kennt die Passwörter nicht.
//   - Nach dem Anmelden bekommt die App einen zufälligen Anmelde-Schlüssel (Token).
//     Auch davon speichert der Server nur den Fingerabdruck.
//   - Zu viele falsche Versuche → eine Viertelstunde Pause (gegen Durchprobieren).

import crypto from "node:crypto";
import { promisify } from "node:util";
import { pool } from "./datenbank.js";

const scrypt = promisify(crypto.scrypt);

const PASSWORT_MIN = 8;
const SITZUNG_TAGE = 180;          // so lange bleibt man angemeldet, wenn man die App nicht benutzt
const MAX_FEHLVERSUCHE = 10;       // pro Viertelstunde
const SPERRE_MS = 15 * 60 * 1000;

// Ein Fehler mit HTTP-Status und freundlichem Text für die App
export class KontoFehler extends Error {
  constructor(status, text) {
    super(text);
    this.status = status;
  }
}

// ---------- Zu viele Versuche? ----------
const versuche = new Map(); // "ip:1.2.3.4" oder "email:a@b.de" → { anzahl, seit }

export function bremse(schluessel) {
  const eintrag = versuche.get(schluessel);
  if (eintrag && Date.now() - eintrag.seit > SPERRE_MS) versuche.delete(schluessel);
  if ((versuche.get(schluessel)?.anzahl || 0) >= MAX_FEHLVERSUCHE) {
    throw new KontoFehler(429, "Zu viele Versuche. Warte eine Viertelstunde und versuch es dann noch einmal.");
  }
}

export function fehlversuch(schluessel) {
  const eintrag = versuche.get(schluessel) || { anzahl: 0, seit: Date.now() };
  eintrag.anzahl++;
  versuche.set(schluessel, eintrag);
}

// ---------- Passwort-Fingerabdruck ----------
async function passwortHash(passwort) {
  const salz = crypto.randomBytes(16);
  const hash = await scrypt(passwort, salz, 64);
  return `scrypt$${salz.toString("base64")}$${hash.toString("base64")}`;
}

async function passwortStimmt(passwort, gespeichert) {
  const [, salz, hash] = gespeichert.split("$");
  const vergleich = await scrypt(passwort, Buffer.from(salz, "base64"), 64);
  const erwartet = Buffer.from(hash, "base64");
  return vergleich.length === erwartet.length && crypto.timingSafeEqual(vergleich, erwartet);
}

// Für unbekannte E-Mails rechnen wir trotzdem einmal: Dann dauert die Antwort gleich lang,
// und niemand kann an der Zeit erkennen, ob es ein Konto gibt.
const ATTRAPPE = passwortHash("attrappe-attrappe");

function fingerabdruck(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// ---------- Eingaben prüfen ----------
function pruefeEmail(email) {
  const sauber = String(email || "").trim().toLowerCase();
  if (sauber.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sauber)) {
    throw new KontoFehler(400, "Bitte gib eine richtige E-Mail-Adresse ein.");
  }
  return sauber;
}

function pruefePasswort(passwort) {
  const text = String(passwort || "");
  if (text.length < PASSWORT_MIN) throw new KontoFehler(400, `Das Passwort braucht mindestens ${PASSWORT_MIN} Zeichen.`);
  if (text.length > 200) throw new KontoFehler(400, "Das Passwort ist zu lang.");
  return text;
}

// ---------- Konto anlegen ----------
// einladungStimmt: Funktion, die den Einladungscode prüft (kommt aus server.js)
export async function registrieren({ email, passwort, einladungscode }, ip, einladungStimmt) {
  bremse(`ip:${ip}`);
  const sauberEmail = pruefeEmail(email);
  const sauberPasswort = pruefePasswort(passwort);
  if (!einladungStimmt(einladungscode)) {
    fehlversuch(`ip:${ip}`);
    throw new KontoFehler(403, "Der Einladungscode stimmt nicht.");
  }

  const hash = await passwortHash(sauberPasswort);
  const ergebnis = await pool.query(
    "INSERT INTO konten (email, passwort_hash) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING RETURNING id",
    [sauberEmail, hash]
  );
  if (ergebnis.rowCount === 0) throw new KontoFehler(409, "Mit dieser E-Mail gibt es schon ein Konto. Melde dich einfach an.");
  return { token: await sitzungAnlegen(ergebnis.rows[0].id), email: sauberEmail };
}

// ---------- Anmelden ----------
export async function anmelden({ email, passwort }, ip) {
  const sauberEmail = String(email || "").trim().toLowerCase();
  bremse(`ip:${ip}`);
  bremse(`email:${sauberEmail}`);

  const ergebnis = await pool.query("SELECT id, passwort_hash FROM konten WHERE email = $1", [sauberEmail]);
  const konto = ergebnis.rows[0];
  const stimmt = await passwortStimmt(String(passwort || ""), konto ? konto.passwort_hash : await ATTRAPPE);
  if (!konto || !stimmt) {
    fehlversuch(`ip:${ip}`);
    fehlversuch(`email:${sauberEmail}`);
    throw new KontoFehler(401, "E-Mail oder Passwort stimmt nicht.");
  }
  versuche.delete(`email:${sauberEmail}`);
  return { token: await sitzungAnlegen(konto.id), email: sauberEmail };
}

// ---------- Anmelde-Schlüssel (Sitzungen) ----------
async function sitzungAnlegen(kontoId) {
  const token = crypto.randomBytes(32).toString("base64url");
  await pool.query("INSERT INTO sitzungen (token_hash, konto_id) VALUES ($1, $2)", [fingerabdruck(token), kontoId]);
  return token;
}

// Wer gehört zu diesem Anmelde-Schlüssel? Ergebnis: { id, email } oder null
export async function kontoZumToken(token) {
  if (!token) return null;
  const ergebnis = await pool.query(
    `SELECT k.id, k.email, s.zuletzt_am FROM sitzungen s JOIN konten k ON k.id = s.konto_id
     WHERE s.token_hash = $1 AND s.zuletzt_am > now() - make_interval(days => $2)`,
    [fingerabdruck(token), SITZUNG_TAGE]
  );
  const zeile = ergebnis.rows[0];
  if (!zeile) return null;
  // Höchstens einmal am Tag vermerken, dass die Sitzung benutzt wurde
  if (Date.now() - new Date(zeile.zuletzt_am).getTime() > 24 * 60 * 60 * 1000) {
    await pool.query("UPDATE sitzungen SET zuletzt_am = now() WHERE token_hash = $1", [fingerabdruck(token)]);
  }
  return { id: zeile.id, email: zeile.email };
}

export async function abmelden(token) {
  if (token) await pool.query("DELETE FROM sitzungen WHERE token_hash = $1", [fingerabdruck(token)]);
}
