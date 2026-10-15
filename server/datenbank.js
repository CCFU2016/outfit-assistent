// datenbank.js – die Verbindung zur Datenbank (Postgres bei Railway)
//
// Railway gibt die Adresse der Datenbank als Variable DATABASE_URL.
// Fehlt sie, läuft der Server trotzdem: dann nur mit Zugangscode, ohne Konten.

import pg from "pg";

export const datenbankVorhanden = Boolean(process.env.DATABASE_URL);

export const pool = datenbankVorhanden
  ? new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    // Über Railways internes Netz braucht es keine Verschlüsselung; über die öffentliche Adresse schon
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  })
  : null;

// Beim Start: die Tabellen anlegen, falls es sie noch nicht gibt
export async function tabellenAnlegen() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS konten (
      id            BIGSERIAL PRIMARY KEY,
      email         TEXT UNIQUE NOT NULL,      -- immer klein geschrieben
      passwort_hash TEXT NOT NULL,             -- nie das Passwort selbst, nur ein "Fingerabdruck"
      erstellt_am   TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS sitzungen (
      token_hash  TEXT PRIMARY KEY,            -- auch hier nur ein Fingerabdruck des Anmelde-Schlüssels
      konto_id    BIGINT NOT NULL REFERENCES konten(id) ON DELETE CASCADE,
      erstellt_am TIMESTAMPTZ NOT NULL DEFAULT now(),
      zuletzt_am  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}
