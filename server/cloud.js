// cloud.js – die Garderobe in der Cloud: Stücke (mit Fotos) und „Heute getragen“
//
// Jedes Gerät lädt seine Änderungen hoch und holt sich die Änderungen der anderen Geräte.
// Gibt es dasselbe Stück verschieden, gewinnt die neueste Änderung (geaendertAm aus der App).
// Gelöschtes bleibt als „gelöscht“ stehen (ohne Fotos), damit es auch auf den anderen Geräten verschwindet.

import { pool } from "./datenbank.js";
import { KontoFehler } from "./konten.js";

const ARTEN = ["teil", "getragen"];
const FOTO = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const SEITE = 200; // so viele Änderungen schicken wir höchstens auf einmal

// Eine Änderung aus der App speichern. Ergebnis: { uebernommen } (false, wenn hier schon Neueres liegt)
export async function speichern(kontoId, { art, id, geaendertAm, geloescht, daten, foto, vorschau } = {}) {
  if (!ARTEN.includes(art)) throw new KontoFehler(400, "Unbekannte Art.");
  if (typeof id !== "string" || !id || id.length > 100) throw new KontoFehler(400, "Die Nummer fehlt.");
  const zeit = new Date(geaendertAm);
  if (typeof geaendertAm !== "string" || Number.isNaN(zeit.getTime())) throw new KontoFehler(400, "Die Zeit fehlt.");
  if (!geloescht) {
    if (!daten || typeof daten !== "object" || Array.isArray(daten)) throw new KontoFehler(400, "Die Angaben fehlen.");
    if (art === "teil" && !(FOTO.test(foto || "") && FOTO.test(vorschau || ""))) throw new KontoFehler(400, "Das Foto fehlt.");
  }
  const mitFoto = !geloescht && art === "teil";

  const verbindung = await pool.connect();
  try {
    await verbindung.query("BEGIN");
    // Pro Konto schreibt immer nur ein Gerät gleichzeitig. So kommen die Stand-Nummern in der richtigen Reihenfolge an.
    await verbindung.query("SELECT pg_advisory_xact_lock($1)", [kontoId]);
    const ergebnis = await verbindung.query(
      `INSERT INTO cloud (konto_id, art, id, daten, foto, vorschau, geloescht, geaendert_am, stand)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, nextval('cloud_stand'))
       ON CONFLICT (konto_id, art, id) DO UPDATE SET
         daten = EXCLUDED.daten, foto = EXCLUDED.foto, vorschau = EXCLUDED.vorschau,
         geloescht = EXCLUDED.geloescht, geaendert_am = EXCLUDED.geaendert_am, stand = EXCLUDED.stand
       WHERE cloud.geaendert_am < EXCLUDED.geaendert_am`,
      [kontoId, art, id, geloescht ? null : daten, mitFoto ? foto : null, mitFoto ? vorschau : null, Boolean(geloescht), zeit]
    );
    await verbindung.query("COMMIT");
    return { uebernommen: ergebnis.rowCount === 1 };
  } catch (fehler) {
    await verbindung.query("ROLLBACK").catch(() => {});
    throw fehler;
  } finally {
    verbindung.release();
  }
}

// Was hat sich seit „seit“ geändert? Ohne Fotos (die holt die App einzeln, nur wenn nötig).
// Ergebnis: { konto, eintraege: [{ art, id, daten, geloescht, geaendertAm }], stand, mehr }
export async function aenderungen(kontoId, seit) {
  const ergebnis = await pool.query(
    `SELECT art, id, daten, geloescht, geaendert_am, stand FROM cloud
     WHERE konto_id = $1 AND stand > $2 ORDER BY stand LIMIT $3`,
    [kontoId, seit, SEITE + 1]
  );
  const zeilen = ergebnis.rows.slice(0, SEITE);
  return {
    konto: Number(kontoId), // so merkt die App, wenn sich ein anderes Konto anmeldet
    eintraege: zeilen.map((zeile) => ({
      art: zeile.art,
      id: zeile.id,
      daten: zeile.daten,
      geloescht: zeile.geloescht,
      geaendertAm: zeile.geaendert_am.toISOString(),
    })),
    stand: zeilen.length ? Number(zeilen.at(-1).stand) : seit,
    mehr: ergebnis.rows.length > SEITE,
  };
}

// Die beiden Fotos eines Stücks: { foto, vorschau } als "data:image/jpeg;base64,…"
export async function fotos(kontoId, id) {
  const ergebnis = await pool.query(
    "SELECT foto, vorschau FROM cloud WHERE konto_id = $1 AND art = 'teil' AND id = $2 AND NOT geloescht",
    [kontoId, String(id || "")]
  );
  const zeile = ergebnis.rows[0];
  if (!zeile) throw new KontoFehler(404, "Dieses Stück gibt es in der Cloud nicht (mehr).");
  return { foto: zeile.foto, vorschau: zeile.vorschau };
}
