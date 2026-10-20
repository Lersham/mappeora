/**
 * Genera public/esempi/nascita-di-roma.mappeora, la mappa di esempio sulla
 * nascita di Roma: la leggenda e la storia vera, ben separate. Foto e dipinti
 * (Wikimedia Commons) e illustrazioni Fluent Emoji sono incorporati nel file.
 *
 *   node scripts/esempi/nascita-di-roma.cjs public/esempi/nascita-di-roma.mappeora [--credits]
 */
const { WHITE: C, photo, run } = require('./common.cjs');

// [label, color, image?, linkWords?, children?]
const tree = ['La nascita di Roma\nVIII – VI secolo a.C.', C, photo('File:The Capitoline Wolf 2010.jpg', 'La Lupa Capitolina, simbolo di Roma, Musei Capitolini'), null, [
  ['La leggenda', C, '📖', 'si racconta nella', [
    ['È un mito: spiega le origini di Roma e le dà un fondatore divino. Non è storia documentata', C],
    ['Enea, principe di Troia, scappa dalla città in fiamme e arriva nel Lazio', C, photo('File:Federico Barocci - Aeneas\' Flight from Troy - WGA01283.jpg', 'La fuga di Enea da Troia, dipinto di Federico Barocci')],
    ['I suoi discendenti regnano ad Alba Longa', C],
    ['Romolo e Remo: gemelli, figli del dio Marte e di Rea Silvia, abbandonati sul Tevere', C],
    ['Li salva e li allatta una lupa. Poi li trova il pastore Faustolo', C, photo('File:Peter Paul Rubens - Romulus and Remus - Google Art Project.jpg', 'Romolo e Remo allattati dalla lupa, dipinto di Rubens')],
    ['Da grandi fondano una città: Romolo sceglie il colle Palatino', C, photo('File:Palatine Hill from Circus Maximus Rome.jpg', 'Il colle Palatino visto dal Circo Massimo')],
    ['Romolo traccia con l’aratro un solco: è il confine sacro della città', C],
    ['Remo scavalca il solco e Romolo lo uccide. Romolo resta solo, primo re di Roma', C],
    ['21 aprile 753 a.C.: la data tradizionale della fondazione, calcolata dallo studioso romano Varrone', C],
  ]],
  ['La storia vera (archeologia)', C, '🏺', 'si studia nella', [
    ['Nel IX – VIII secolo a.C. sui colli ci sono villaggi di pastori e contadini, con capanne di legno e paglia', C, photo('File:Villanovan - Urn in the Shape of a Hut and a Door - Walters 482312.jpg', 'Urna a forma di capanna (cultura villanoviana, IX – VIII secolo a.C.)')],
    ['Il Tevere: vicino all’isola Tiberina c’è un guado, un punto dove si può attraversare il fiume', C, photo('File:2024-10-12 Rome, Tiber Island.jpg', 'L’isola Tiberina a Roma')],
    ['Passa di qui la strada del sale, che dal mare porta il sale all’interno. Roma controlla il passaggio', C],
    ['Latini e Sabini: popoli vicini, che vivono sui colli e si mescolano', C],
    ['Tra l’VIII e il VII secolo a.C. i villaggi dei sette colli si uniscono in una sola città', C],
    ['Gli Etruschi, a nord del Tevere, sono molto sviluppati e influenzano Roma: mura, templi, strade e fogne', C, photo('File:Sarcofago degli sposi.jpg', 'Il Sarcofago degli Sposi, opera etrusca del VI secolo a.C., Museo di Villa Giulia')],
    ['Non sappiamo se Romolo sia davvero esistito', C],
  ]],
  ['I sette re', C, '👑', 'è governata da', [
    ['Le date sono quelle della tradizione: i primi re sono in parte leggendari', C],
    ['1. Romolo (753 – 716 a.C.): fonda la città e crea il Senato', C],
    ['2. Numa Pompilio (715 – 673 a.C.): re pacifico, organizza la religione', C],
    ['3. Tullo Ostilio (673 – 642 a.C.): re guerriero, distrugge Alba Longa', C],
    ['4. Anco Marzio (642 – 617 a.C.): fonda il porto di Ostia', C],
    ['5. Tarquinio Prisco (616 – 579 a.C.): re etrusco, costruisce il Circo Massimo', C],
    ['6. Servio Tullio (578 – 535 a.C.): divide i cittadini in classi secondo la ricchezza, costruisce le mura', C],
    ['7. Tarquinio il Superbo (534 – 509 a.C.): re etrusco, governa da tiranno', C],
  ]],
  ['La società', C, null, 'comprende', [
    ['Il re: capo dell’esercito, giudice e sacerdote', C],
    ['Patrizi: famiglie nobili e ricche. Hanno il potere', C],
    ['Plebei: gli altri cittadini, come contadini, artigiani e commercianti. Non contano nelle decisioni', C],
    ['Il Senato: il consiglio degli anziani patrizi, che consiglia il re', C, photo('File:Cicero Denounces Catiline in the Roman Senate by Cesare Maccari - 2.jpg', 'Il Senato romano, dipinto ottocentesco di Cesare Maccari (una seduta del tempo della Repubblica)')],
    ['Schiavi: non hanno diritti', C],
  ]],
  ['La fine della monarchia', C, '🏛️', 'finisce con', [
    ['Tarquinio il Superbo governa da tiranno e i Romani si ribellano', C],
    ['509 a.C. (secondo la tradizione): i Romani, guidati da Lucio Giunio Bruto, cacciano il re', C, photo('File:Capitoline Brutus Musei Capitolini MC1183.jpg', 'Il «Bruto capitolino», busto in bronzo, Musei Capitolini')],
    ['Il potere passa a due consoli, eletti ogni anno', C],
    ['Nasce la Repubblica romana', C],
    ['Per gli storici il cambiamento fu forse più lento di così', C],
    ['I Romani non vorranno mai più un re', C],
  ]],
]];

run('La nascita di Roma', tree);
