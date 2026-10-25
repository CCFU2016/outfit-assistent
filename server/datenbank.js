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

    -- Die Garderobe in der Cloud (siehe cloud.js): Stücke mit Fotos und „Heute getragen“
    CREATE SEQUENCE IF NOT EXISTS cloud_stand;
    CREATE TABLE IF NOT EXISTS cloud (
      konto_id     BIGINT NOT NULL REFERENCES konten(id) ON DELETE CASCADE,
      art          TEXT NOT NULL,              -- "teil" oder "getragen"
      id           TEXT NOT NULL,              -- die Nummer aus der App
      daten        JSONB,                      -- alle Angaben außer den Fotos (leer, wenn gelöscht)
      foto         TEXT,                       -- nur bei Stücken: "data:image/jpeg;base64,…"
      vorschau     TEXT,
      geloescht    BOOLEAN NOT NULL DEFAULT false,
      geaendert_am TIMESTAMPTZ NOT NULL,       -- wann es in der App geändert wurde: das Neueste gewinnt
      stand        BIGINT NOT NULL,            -- fortlaufende Nummer: „Was ist neu seit meinem letzten Abgleich?“
      PRIMARY KEY (konto_id, art, id)
    );
    CREATE INDEX IF NOT EXISTS cloud_nach_stand ON cloud (konto_id, stand);
  `);
}
