// fotos.js – Fotos verkleinern, bevor sie gespeichert werden
// Wichtig: Wir ändern nur die Größe. Keine Filter, keine Farbänderung.

const GROSS = 1280; // längste Seite des gespeicherten Fotos (in Pixeln)
const KLEIN = 480;  // längste Seite des Vorschaubilds für den Kleiderschrank

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

// Ein Bild auf eine neue "Leinwand" (canvas) zeichnen, höchstens maxSeite groß
function zeichne(quelle, maxSeite) {
  const breite = quelle.naturalWidth || quelle.width;
  const hoehe = quelle.naturalHeight || quelle.height;
  const faktor = Math.min(1, maxSeite / Math.max(breite, hoehe)); // nie vergrößern

  const leinwand = document.createElement("canvas");
  leinwand.width = Math.round(breite * faktor);
  leinwand.height = Math.round(hoehe * faktor);

  const stift = leinwand.getContext("2d");
  stift.fillStyle = "#FFFFFF"; // durchsichtige Stellen (bei manchen Bildern) werden weiß statt schwarz
  stift.fillRect(0, 0, leinwand.width, leinwand.height);
  stift.imageSmoothingQuality = "high";
  stift.drawImage(quelle, 0, 0, leinwand.width, leinwand.height);
  return leinwand;
}

// Die Leinwand als JPEG-Bild speichern (qualitaet: 0 bis 1)
function alsJpeg(leinwand, qualitaet) {
  return new Promise((fertig, fehler) => {
    leinwand.toBlob(
      (bild) => (bild ? fertig(bild) : fehler(new Error("Foto konnte nicht umgewandelt werden"))),
      "image/jpeg",
      qualitaet
    );
  });
}
