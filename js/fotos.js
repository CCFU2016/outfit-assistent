// fotos.js – Fotos verkleinern, bevor sie gespeichert werden (und Fotos in Text umwandeln und zurück)
// Wichtig: Wir ändern nur die Größe. Keine Filter, keine Farbänderung.

const GROSS = 1280; // längste Seite des gespeicherten Fotos (in Pixeln)
const KLEIN = 480;  // längste Seite des Vorschaubilds für den Kleiderschrank
const AUSSCHNITT = 800; // längste Seite des ausgeschnittenen Bilds für die Puppe

// Aus der Datei von Kamera oder Galerie werden zwei JPEG-Bilder: { foto, vorschau }
export async function verkleinereFoto(datei) {
  const adresse = URL.createObjectURL(datei);
  try {
    const bild = new Image();
    bild.src = adresse;
    await bild.decode(); // warten, bis das Foto geladen ist (der Browser dreht es dabei richtig herum)

    const gross = zeichne(bild, GROSS);
    const klein = zeichne(gross, KLEIN);
    return {
      foto: await alsJpeg(gross, 0.85),
      vorschau: await alsJpeg(klein, 0.8),
    };
  } finally {
    URL.revokeObjectURL(adresse);
  }
}

// ---------- Ausgeschnittenes Bild für die Puppe ----------
// Das Bild kommt z. B. von „Motiv kopieren“ auf dem iPhone und hat einen durchsichtigen Hintergrund.
// Hier wird der leere Rand weggeschnitten und das Bild verkleinert. Es bleibt ein PNG,
// denn nur PNG kann durchsichtig sein. Hat das Bild noch einen Hintergrund, gibt es einen Fehler.
export async function bereiteAusschnittVor(datei) {
  const adresse = URL.createObjectURL(datei);
  try {
    const bild = new Image();
    bild.src = adresse;
    await bild.decode();
    const leinwand = zeichne(bild, 1600, null);
    const { width: breite, height: hoehe } = leinwand;
    const punkte = leinwand.getContext("2d").getImageData(0, 0, breite, hoehe).data;

    // Wo ist etwas zu sehen, und wie viel ist durchsichtig?
    let links = breite, rechts = -1, oben = hoehe, unten = -1, durchsichtig = 0;
    for (let y = 0; y < hoehe; y++) {
      for (let x = 0; x < breite; x++) {
        const deckkraft = punkte[(y * breite + x) * 4 + 3];
        if (deckkraft < 250) durchsichtig++;
        if (deckkraft > 16) {
          if (x < links) links = x;
          if (x > rechts) rechts = x;
          if (y < oben) oben = y;
          if (y > unten) unten = y;
        }
      }
    }
    if (rechts < 0) throw new Error("Auf diesem Bild ist nichts zu sehen.");
    if (durchsichtig < breite * hoehe * 0.03) {
      throw new Error("Auf diesem Bild ist der Hintergrund noch da. Auf der Puppe wäre das ein Rechteck. " +
        "Schneide das Stück zuerst aus (siehe „So geht's“) und setze es dann ein.");
    }

    const ausschnittBreite = rechts - links + 1;
    const ausschnittHoehe = unten - oben + 1;
    const faktor = Math.min(1, AUSSCHNITT / Math.max(ausschnittBreite, ausschnittHoehe));
    const ziel = document.createElement("canvas");
    ziel.width = Math.max(1, Math.round(ausschnittBreite * faktor));
    ziel.height = Math.max(1, Math.round(ausschnittHoehe * faktor));
    const stift = ziel.getContext("2d");
    stift.imageSmoothingQuality = "high";
    stift.drawImage(leinwand, links, oben, ausschnittBreite, ausschnittHoehe, 0, 0, ziel.width, ziel.height);
    return await alsDatei(ziel, "image/png");
  } finally {
    URL.revokeObjectURL(adresse);
  }
}

// Ein Bild auf eine neue "Leinwand" (canvas) zeichnen, höchstens maxSeite groß.
// hintergrund: Farbe für durchsichtige Stellen, null = durchsichtig lassen
function zeichne(quelle, maxSeite, hintergrund = "#FFFFFF") {
  const breite = quelle.naturalWidth || quelle.width;
  const hoehe = quelle.naturalHeight || quelle.height;
  const faktor = Math.min(1, maxSeite / Math.max(breite, hoehe)); // nie vergrößern

  const leinwand = document.createElement("canvas");
  leinwand.width = Math.round(breite * faktor);
  leinwand.height = Math.round(hoehe * faktor);

  const stift = leinwand.getContext("2d", { willReadFrequently: hintergrund === null });
  if (hintergrund) {
    stift.fillStyle = hintergrund; // durchsichtige Stellen (bei manchen Bildern) werden weiß statt schwarz
    stift.fillRect(0, 0, leinwand.width, leinwand.height);
  }
  stift.imageSmoothingQuality = "high";
  stift.drawImage(quelle, 0, 0, leinwand.width, leinwand.height);
  return leinwand;
}

// Die Leinwand als JPEG-Bild speichern (qualitaet: 0 bis 1)
function alsJpeg(leinwand, qualitaet) {
  return alsDatei(leinwand, "image/jpeg", qualitaet);
}

function alsDatei(leinwand, typ, qualitaet) {
  return new Promise((fertig, fehler) => {
    leinwand.toBlob(
      (bild) => (bild ? fertig(bild) : fehler(new Error("Foto konnte nicht umgewandelt werden"))),
      typ,
      qualitaet
    );
  });
}

// Foto (Blob) → Text "data:image/jpeg;base64,…" (für Sicherung, Cloud und Erkennen)
export function alsText(bild) {
  return new Promise((fertig, fehler) => {
    const leser = new FileReader();
    leser.onload = () => fertig(leser.result);
    leser.onerror = () => fehler(leser.error);
    leser.readAsDataURL(bild);
  });
}

// Text "data:image/jpeg;base64,…" → Foto (Blob)
export function alsBild(text) {
  const treffer = /^data:([^;,]+);base64,(.*)$/s.exec(text);
  if (!treffer) throw new Error("kein Foto");
  const bytes = atob(treffer[2]);
  const daten = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) daten[i] = bytes.charCodeAt(i);
  return new Blob([daten], { type: treffer[1] });
}
