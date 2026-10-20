/**
 * Genera public/esempi/rivoluzione-francese.mappeora, la mappa di esempio
 * sulla Rivoluzione francese: foto e dipinti dell’epoca (Wikimedia Commons)
 * e illustrazioni Fluent Emoji, incorporati nel file.
 *
 *   node scripts/esempi/rivoluzione-francese.cjs public/esempi/rivoluzione-francese.mappeora [--credits]
 */
const { WHITE: C, photo, run } = require('./common.cjs');

// [label, color, image?, linkWords?, children?]
const tree = ['La Rivoluzione francese\n1789 – 1799', C, '✊', null, [
  ['Le cause', C, null, 'nasce da', [
    ['Crisi economica: lo Stato è pieno di debiti', C, '💸'],
    ['Raccolti scarsi: il pane costa troppo', C],
    ['Società ingiusta, divisa in tre ordini (Ancien Régime)', C, null, null, [
      ['Clero e nobiltà: hanno privilegi e non pagano le tasse', C],
      ['Terzo Stato: borghesi, contadini e popolo. Paga le tasse', C],
    ]],
    ['Idee dell’Illuminismo: libertà e uguaglianza', C],
    ['L’esempio della Rivoluzione americana (1776)', C],
  ]],
  ['Lo scoppio, nel 1789', C, null, 'inizia con', [
    ['5 maggio: il re Luigi XVI convoca gli Stati Generali a Versailles', C, photo('File:Ouverture des Etats-Généraux à Versailles le 5 mai 1789, G.25232.jpg', 'L’apertura degli Stati Generali a Versailles, 5 maggio 1789')],
    ['17 giugno: il Terzo Stato si proclama Assemblea nazionale', C],
    ['20 giugno: Giuramento della Pallacorda. I deputati giurano di non separarsi finché la Francia non avrà una Costituzione', C, photo('File:Couder - Le Serment du Jeu de Paume, 20 juin 1789.jpg', 'Il Giuramento della Pallacorda, dipinto ottocentesco di Auguste Couder')],
    ['14 luglio: il popolo di Parigi prende la Bastiglia, fortezza-prigione simbolo del potere del re', C, photo('File:Anonyme - Prise de la Bastille.jpg', 'La presa della Bastiglia, dipinto anonimo del 1789 circa')],
    ['4 agosto: aboliti i privilegi feudali', C],
    ['26 agosto: Dichiarazione dei diritti dell’uomo e del cittadino', C, photo('File:Declaration of the Rights of Man and of the Citizen in 1789.jpg', 'La Dichiarazione dei diritti dell’uomo e del cittadino, 1789')],
  ]],
  ['Le fasi', C, null, 'si svolge in', [
    ['Monarchia costituzionale (1789 – 1792)', C, null, '1ª fase', [
      ['1791: la Costituzione limita il potere del re', C],
      ['1791: il re tenta la fuga ed è fermato a Varennes', C],
    ]],
    ['Repubblica (1792)', C, '🏛️', '2ª fase', [
      ['Guerra contro Austria e Prussia', C],
      ['1793: Luigi XVI viene condannato e ghigliottinato', C],
    ]],
    ['Il Terrore (1793 – 1794)', C, null, '3ª fase', [
      ['Robespierre e i giacobini al potere', C],
      ['Migliaia di condanne a morte. Finisce con la morte di Robespierre (1794)', C],
    ]],
    ['Il Direttorio (1795 – 1799)', C, null, '4ª fase', [
      ['1799: colpo di Stato del generale Napoleone', C],
    ]],
  ]],
  ['Le conseguenze', C, null, 'porta a', [
    ['Fine dell’Ancien Régime e dei privilegi', C],
    ['Tutti uguali davanti alla legge', C],
    ['Il potere viene dal popolo (sovranità popolare)', C],
    ['Le nuove idee si diffondono in Europa', C],
  ]],
  ['I protagonisti', C, null, 'ha come', [
    ['Luigi XVI, re di Francia', C, photo('File:Louis XVI of France.jpg', 'Luigi XVI, ritratto di Joseph-Siffred Duplessis')],
    ['Maria Antonietta, regina di Francia, moglie di Luigi XVI', C, photo('File:Louise Elisabeth Vigée-Lebrun - Marie-Antoinette de Lorraine-Habsbourg, reine de France et ses enfants - Google Art Project.jpg', 'Maria Antonietta con i figli, dipinto di Élisabeth Vigée Le Brun')],
    ['Robespierre, capo dei giacobini', C, photo('File:Robespierre.jpg', 'Maximilien de Robespierre, ritratto di un pittore sconosciuto')],
    ['Napoleone Bonaparte, generale', C, photo('File:Antoine-Jean Gros - Bonaparte au pont d\'Arcole.jpg', 'Napoleone Bonaparte sul ponte di Arcole, dipinto di Antoine-Jean Gros')],
  ]],
  ['Libertà, uguaglianza, fraternità', C, '🤝', 'il suo motto'],
]];

run('La Rivoluzione francese', tree);
