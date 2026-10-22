/**
 * Genera public/esempi/civilta-egizia.mappeora, la mappa di esempio sulla
 * civiltà egizia: foto vere (Wikimedia Commons) e illustrazioni Fluent Emoji,
 * incorporate nel file.
 *
 *   node scripts/esempi/civilta-egizia.cjs public/esempi/civilta-egizia.mappeora [--credits]
 */
const { WHITE: C, photo, run } = require('./common.cjs');

// [label, color, image?, linkWords?, children?]
const tree = ['La civiltà egizia\n3100 a.C. – 30 a.C.', C, '🏺', null, [
  ['Il Nilo', C, photo('File:Nile River and delta from orbit.jpg', 'Il Nilo e il suo delta visti dallo spazio (foto NASA)'), 'dipende da', [
    ['«L’Egitto è un dono del Nilo»: lo scrive lo storico greco Erodoto', C],
    ['Ogni estate il fiume si ingrossa e inonda i campi: è la piena', C, '🌊'],
    ['Quando l’acqua si ritira lascia il limo, un fango nero e fertile', C],
    ['I contadini coltivano grano, orzo, lino e papiro', C],
    ['Oltre la valle c’è il deserto, la «terra rossa»', C],
  ]],
  ['Le epoche', C, null, 'si divide in', [
    ['Circa 3100 a.C.: il re Narmer unisce l’Alto e il Basso Egitto', C],
    ['Antico Regno (circa 2700 – 2200 a.C.): l’età delle piramidi', C],
    ['Medio Regno (circa 2050 – 1650 a.C.)', C],
    ['Nuovo Regno (circa 1550 – 1070 a.C.): l’Egitto è più potente e ricco', C],
    ['30 a.C.: l’Egitto diventa una provincia di Roma', C],
  ]],
  ['Le classi sociali', C, null, 'si organizza in', [
    ['Il faraone: il re, considerato figlio degli dèi. Comanda su tutto', C, '👑'],
    ['I sacerdoti: servono gli dèi nei templi', C],
    ['Gli scribi: sanno scrivere e contare. Segnano raccolti e tasse', C, photo('File:Le Scribe accroupi - Musée du Louvre Antiquités égyptiennes E 3023.jpg', 'Lo scriba accovacciato del Louvre, statua di circa 2500 a.C.')],
    ['I contadini e gli artigiani: coltivano, costruiscono e producono', C],
    ['Gli schiavi: spesso prigionieri di guerra, senza diritti', C],
  ]],
  ['Gli dèi e l’aldilà', C, null, 'crede in', [
    ['Tanti dèi (politeismo), spesso con la testa di un animale', C, null, null, [
      ['Ra: il dio del sole', C, '☀️'],
      ['Osiride: dio dei morti e della rinascita', C],
      ['Iside: dea della magia, moglie di Osiride', C],
      ['Anubi: dio con la testa di sciacallo, accompagna i morti', C],
    ]],
    ['La vita dopo la morte', C, null, null, [
      ['Gli Egizi credono nell’aldilà: la vita continua dopo la morte', C],
      ['Il corpo si conserva con la mummificazione e si mette in un sarcofago', C, photo('File:Egyptian Mummy & Sarcophagus Lid (48464764551).jpg', 'Una mummia con il suo sarcofago, Musei Vaticani')],
      ['Nella tomba si lasciano cibo e oggetti, per il viaggio nell’aldilà', C],
      ['Osiride pesa il cuore del morto: chi è stato buono può entrare nell’aldilà', C],
    ]],
  ]],
  ['Piramidi e templi', C, null, 'costruisce', [
    ['Le piramidi: tombe dei faraoni. Non le costruirono gli schiavi, ma operai pagati e contadini', C],
    ['Giza: le tre grandi piramidi di Cheope, Chefren e Micerino', C, photo('File:All Gizah Pyramids.jpg', 'Le piramidi di Giza')],
    ['La Sfinge: un leone con la testa d’uomo, a guardia di Giza', C, photo('File:Great Sphinx of Giza - 20080716a.jpg', 'La Grande Sfinge di Giza')],
    ['I templi: la casa degli dèi', C],
    ['Abu Simbel: tempio di Ramses II, scavato nella roccia', C, photo('File:Abu Simbel Temple May 30 2007.jpg', 'Il tempio di Ramses II ad Abu Simbel')],
    ['Valle dei Re: i faraoni del Nuovo Regno sono sepolti in tombe scavate nella roccia', C],
  ]],
  ['La scrittura', C, '✍️', 'conosce', [
    ['Geroglifici: disegni che indicano parole e suoni', C],
    ['Si scrive su papiro, una pianta del Nilo, con canne e inchiostro', C],
    ['Pietra di Rosetta (trovata nel 1799): lo stesso testo in geroglifico, demotico e greco', C, photo('File:Rosetta Stone.JPG', 'La Stele di Rosetta, British Museum')],
    ['1822: Champollion la usa per decifrare i geroglifici', C],
  ]],
  ['I faraoni più famosi', C, null, 'ricorda', [
    ['Cheope (circa 2600 a.C.): fa costruire la Grande Piramide di Giza', C],
    ['Hatshepsut (circa 1470 a.C.): una delle poche donne faraone', C],
    ['Ramses II (1279 – 1213 a.C.): regna 66 anni. Fa costruire Abu Simbel', C],
    ['Tutankhamon (circa 1332 – 1323 a.C.): diventa faraone da bambino. La sua tomba è stata trovata quasi intatta nel 1922', C, photo('File:CairoEgMuseumTaaMaskMostlyPhotographed.jpg', 'La maschera d’oro di Tutankhamon, Museo Egizio del Cairo')],
    ['Cleopatra VII (69 – 30 a.C.): l’ultima regina d’Egitto', C, photo('File:Bust of Cleopatra VII - Altes Museum - Berlin - Germany 2017.jpg', 'Busto di Cleopatra VII, Altes Museum di Berlino')],
  ]],
]];

run('La civiltà egizia', tree);
