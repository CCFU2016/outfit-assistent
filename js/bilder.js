// bilder.js – gespeicherte Fotos anzeigen
// Ein Foto aus der Datenbank bekommt eine vorübergehende Adresse (blob:…),
// die ein <img> anzeigen kann. Diese Adressen geben wir wieder frei,
// wenn wir neu zeichnen, damit der Speicher des Handys nicht vollläuft.

export function bildAdressen() {
  let liste = [];
  return {
    neu(bild) {
      const adresse = URL.createObjectURL(bild);
      liste.push(adresse);
      return adresse;
    },
    freigeben() {
      for (const adresse of liste) URL.revokeObjectURL(adresse);
      liste = [];
    },
  };
}

// Ein <img> für ein Kleidungsfoto (immer mit der Klasse "foto": nie Filter!)
export function fotoBild(adresse, beschreibung) {
  const bild = document.createElement("img");
  bild.className = "foto";
  bild.src = adresse;
  bild.alt = beschreibung;
  bild.decoding = "async";
  return bild;
}
