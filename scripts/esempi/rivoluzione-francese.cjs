/**
 * Genera public/esempi/rivoluzione-francese.mappeora, la mappa di esempio
 * sulla Rivoluzione francese (illustrazioni Fluent Emoji incorporate).
 *
 *   node scripts/esempi/rivoluzione-francese.cjs public/esempi/rivoluzione-francese.mappeora
 */
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const index = require('../../src/data/illustrations.json');
const COMMIT = index.commit;
const pathOf = (g) => index.items.find((i) => i.g.replace(/️/g, '') === g.replace(/️/g, '')).p;
const img = (g) => {
  const p = pathOf(g);
  const url = `https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@${COMMIT}/assets/${p.split('/').map(encodeURIComponent).join('/')}.png`;
  const b64 = execFileSync('curl', ['-s', '-m', '30', '--fail', url], { maxBuffer: 1e8 }).toString('base64');
  return { kind: 'illustrazione', ref: p, src: `data:image/png;base64,${b64}` };
};

const C = { root: '#ffd166', cause: '#ffaebc', inizio: '#a0e7e5', fasi: '#cdb4db', conseguenze: '#b4f8c8', persone: '#fbe7c6', motto: '#ffffff' };

// [label, color, emoji?, linkWords?, children?]
const tree = ['La Rivoluzione francese\n1789 – 1799', C.root, '✊', null, [
  ['Le cause', C.cause, null, 'nasce da', [
    ['Crisi economica: lo Stato è pieno di debiti', C.cause, '💸'],
    ['Raccolti scarsi: il pane costa troppo', C.cause, '🌾'],
    ['Società ingiusta, divisa in tre ordini (Ancien Régime)', C.cause, null, null, [
      ['Clero e nobiltà: hanno privilegi e non pagano le tasse', C.cause],
      ['Terzo Stato: borghesi, contadini e popolo. Paga le tasse', C.cause],
    ]],
    ['Idee dell’Illuminismo: libertà e uguaglianza', C.cause, '💡'],
    ['L’esempio della Rivoluzione americana (1776)', C.cause],
  ]],
  ['Lo scoppio, nel 1789', C.inizio, '📅', 'inizia con', [
    ['5 maggio: il re convoca gli Stati Generali a Versailles', C.inizio],
    ['20 giugno: Giuramento della Pallacorda. Il Terzo Stato diventa Assemblea nazionale', C.inizio, '🎾'],
    ['14 luglio: presa della Bastiglia', C.inizio, '🏰'],
    ['4 agosto: aboliti i privilegi feudali', C.inizio],
    ['26 agosto: Dichiarazione dei diritti dell’uomo e del cittadino', C.inizio, '📜'],
  ]],
  ['Le fasi', C.fasi, '⏳', 'si svolge in', [
    ['Monarchia costituzionale (1789 – 1792)', C.fasi, '👑', '1ª fase', [
      ['1791: la Costituzione limita il potere del re', C.fasi],
      ['1791: il re tenta la fuga ed è fermato a Varennes', C.fasi],
    ]],
    ['Repubblica (1792)', C.fasi, '🏛️', '2ª fase', [
      ['Guerra contro Austria e Prussia', C.fasi],
      ['1793: Luigi XVI viene ghigliottinato', C.fasi],
    ]],
    ['Il Terrore (1793 – 1794)', C.fasi, '😱', '3ª fase', [
      ['Robespierre e i giacobini al potere', C.fasi],
      ['Migliaia di condanne a morte. Finisce con la morte di Robespierre (1794)', C.fasi],
    ]],
    ['Il Direttorio (1795 – 1799)', C.fasi, null, '4ª fase', [
      ['1799: colpo di Stato di Napoleone', C.fasi, '🎖️'],
    ]],
  ]],
  ['Le conseguenze', C.conseguenze, '🌍', 'porta a', [
    ['Fine dell’Ancien Régime e dei privilegi', C.conseguenze],
    ['Tutti uguali davanti alla legge', C.conseguenze],
    ['Il potere viene dal popolo (sovranità popolare)', C.conseguenze],
    ['Le nuove idee si diffondono in Europa', C.conseguenze],
  ]],
  ['I protagonisti', C.persone, '🧑', null, [
    ['Luigi XVI, re di Francia, e Maria Antonietta', C.persone],
    ['Robespierre, capo dei giacobini', C.persone],
    ['Napoleone Bonaparte, generale', C.persone],
  ]],
  ['Libertà, uguaglianza, fraternità', C.motto, '🤝', 'il suo motto'],
]];

const nodes = [];
const edges = [];
let row = 0;
const walk = ([label, color, emoji, link, children = []], depth, parentId) => {
  const id = crypto.randomUUID();
  if (link) row += 0.3;
  const node = { id, label, position: { x: depth * 56, y: Math.round(row * 100) }, color, shape: depth === 0 ? 'ellisse' : 'rettangolo' };
  if (emoji) node.image = img(emoji);
  nodes.push(node);
  row++;
  if (parentId) edges.push({ id: crypto.randomUUID(), source: parentId, target: id, ...(link && { label: link }) });
  for (const c of children) walk(c, depth + 1, id);
};
walk(tree, 0, null);
const now = Date.now();
const file = { format: 'mappeora', version: 1, map: { id: crypto.randomUUID(), title: 'La Rivoluzione francese', createdAt: now, updatedAt: now, template: 'libera', nodes, edges } };
fs.writeFileSync(process.argv[2], JSON.stringify(file));
console.log(nodes.length, 'concetti,', edges.length, 'collegamenti,', nodes.filter((n) => n.image).length, 'immagini,', Math.round(fs.statSync(process.argv[2]).size / 1024), 'KB');
