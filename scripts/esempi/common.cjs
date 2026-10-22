/**
 * Shared code of the example-map generators (see the other scripts in this folder).
 *
 * A tree is written as nested arrays:
 *   [label, color, image?, linkWords?, children?]
 * where `image` is either an emoji (a Fluent Emoji 3D illustration, embedded as
 * a PNG) or `photo(file, what)`: a real picture from Wikimedia Commons, embedded
 * as a small JPEG with kind 'foto'. Only Public Domain, CC0 or Creative Commons
 * files are used; the license, the author and the link of each file are read from
 * the Commons API at generation time and printed with `--credits`, ready for
 * public/crediti.html.
 *
 *   node scripts/esempi/<name>.cjs public/esempi/<name>.mappeora [--credits]
 *
 * Wikimedia asks for a User-Agent and rate-limits hard, so every request carries
 * one, waits between requests and honors "retry-after". Downloads are cached in
 * the system temp folder (MAPPAMI_EXAMPLES_CACHE to change it), so a second run
 * does not ask Wikimedia again.
 */
const { spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const index = require('../../src/data/illustrations.json');

const USER_AGENT = 'MappAmi-examples/1.0 (https://mapp-ami.vercel.app)';
const API = 'https://commons.wikimedia.org/w/api.php';
const CACHE = process.env.MAPPAMI_EXAMPLES_CACHE || path.join(os.tmpdir(), 'mappami-esempi-cache');
const PAUSE_SECONDS = 2;
// Wikimedia only serves a few standard thumbnail widths (250 is one of them); other widths answer 400.
const PHOTO_WIDTH = 250;
const PHOTO_MAX_KB = 45;
// Licenses accepted for the photos: public domain, CC0, or Creative Commons with attribution.
const ALLOWED_LICENSE = /^(public domain|pd\b|cc0|cc by(-sa)?\b)/i;

// White, like a new map: «Riordina e colora» gives every branch a pastel color.
const WHITE = '#ffffff';

const sleep = (seconds) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, seconds * 1000);
fs.mkdirSync(CACHE, { recursive: true });

/** Runs curl and returns { status, headers, body }. */
function curl(args) {
  const headerFile = path.join(CACHE, `.headers-${process.pid}`);
  const r = spawnSync('curl', ['-s', '-m', '60', '-A', USER_AGENT, '-D', headerFile, ...args], { maxBuffer: 1e8 });
  const headers = fs.existsSync(headerFile) ? fs.readFileSync(headerFile, 'utf8') : '';
  fs.rmSync(headerFile, { force: true });
  const statuses = [...headers.matchAll(/^HTTP\/[\d.]+ (\d+)/gm)];
  const status = statuses.length ? Number(statuses[statuses.length - 1][1]) : 0;
  return { status, headers, body: r.stdout };
}

/** GET with a pause afterwards and patient retries when Wikimedia says "too many requests". */
function politeGet(args) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const r = curl(args);
    if (r.status === 200) {
      sleep(PAUSE_SECONDS);
      return r.body;
    }
    if (r.status !== 429 && r.status !== 503 && r.status !== 0) throw new Error(`HTTP ${r.status}: ${args[args.length - 1]}`);
    const wait = Number((r.headers.match(/^retry-after: *(\d+)/im) || [0, 45])[1]) + 5;
    console.error(`Wikimedia: too many requests, waiting ${wait}s`);
    sleep(wait);
  }
  throw new Error(`Wikimedia keeps refusing: ${args[args.length - 1]}`);
}

const plain = (html) =>
  String(html || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, '’')
    .replace(/\s+/g, ' ')
    .trim();

/** Fluent Emoji illustration, as the app saves it. */
const COMMIT = index.commit;
const illustrationPath = (g) => {
  const item = index.items.find((i) => i.g.replace(/️/g, '') === g.replace(/️/g, ''));
  if (!item) throw new Error(`No Fluent Emoji for ${g}`);
  return item.p;
};
function illustration(emoji) {
  const p = illustrationPath(emoji);
  const cache = path.join(CACHE, `emoji-${crypto.createHash('sha1').update(p).digest('hex')}.png`);
  if (!fs.existsSync(cache)) {
    const url = `https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@${COMMIT}/assets/${p.split('/').map(encodeURIComponent).join('/')}.png`;
    fs.writeFileSync(cache, politeGet(['--fail', url]));
  }
  return { kind: 'illustrazione', ref: p, src: `data:image/png;base64,${fs.readFileSync(cache).toString('base64')}` };
}

/** A real picture from Wikimedia Commons: `file` is the Commons title, e.g. 'File:Rosetta Stone.JPG'. */
const photo = (file, what) => ({ photo: file, what });
const isPhoto = (v) => v && typeof v === 'object' && typeof v.photo === 'string';

const credits = [];

/** Reads the license data of every photo with one API request and downloads the thumbnails. */
function fetchPhotos(specs) {
  const unique = [...new Map(specs.map((s) => [s.photo, s])).values()];
  const infoFile = path.join(CACHE, `info-${crypto.createHash('sha1').update(unique.map((s) => s.photo).join('|')).digest('hex')}.json`);
  let pages;
  if (fs.existsSync(infoFile)) {
    pages = JSON.parse(fs.readFileSync(infoFile, 'utf8'));
  } else {
    const params = { action: 'query', format: 'json', prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: PHOTO_WIDTH, redirects: 1, titles: unique.map((s) => s.photo).join('|') };
    const args = ['-G', '-s'];
    for (const [k, v] of Object.entries(params)) args.push('--data-urlencode', `${k}=${v}`);
    args.push(API);
    const json = JSON.parse(politeGet(args));
    pages = { redirects: json.query.redirects || [], pages: Object.values(json.query.pages) };
    fs.writeFileSync(infoFile, JSON.stringify(pages));
  }
  const byTitle = new Map(pages.pages.map((p) => [p.title, p]));
  const data = new Map();
  for (const s of unique) {
    const redirected = pages.redirects.find((r) => r.from === s.photo);
    const page = byTitle.get(redirected ? redirected.to : s.photo);
    const info = page && page.imageinfo && page.imageinfo[0];
    if (!info) throw new Error(`Not on Commons: ${s.photo}`);
    const meta = info.extmetadata || {};
    const license = plain(meta.LicenseShortName && meta.LicenseShortName.value);
    if (!ALLOWED_LICENSE.test(license)) throw new Error(`License not accepted for ${s.photo}: "${license}"`);
    const cache = path.join(CACHE, `photo-${crypto.createHash('sha1').update(`${s.photo}@${PHOTO_WIDTH}`).digest('hex')}.jpg`);
    if (!fs.existsSync(cache)) fs.writeFileSync(cache, politeGet(['--fail', info.thumburl]));
    const jpeg = fs.readFileSync(cache);
    if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) throw new Error(`Not a JPEG: ${s.photo}`);
    if (jpeg.length > PHOTO_MAX_KB * 1024) console.error(`Warning: ${s.photo} is ${Math.round(jpeg.length / 1024)} KB, use a smaller width`);
    const licenseUrl = plain(meta.LicenseUrl && meta.LicenseUrl.value);
    data.set(s.photo, { ref: `data:image/jpeg;base64,${jpeg.toString('base64')}` });
    credits.push({
      what: s.what,
      file: page.title,
      page: info.descriptionurl,
      author: plain(meta.Artist && meta.Artist.value) || 'autore non indicato',
      license,
      licenseUrl,
      kb: Math.round(jpeg.length / 1024),
    });
  }
  return data;
}

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function printCredits() {
  for (const c of credits) {
    const license = c.licenseUrl ? `<a href="${escapeHtml(c.licenseUrl)}" rel="noopener">${escapeHtml(c.license)}</a>` : escapeHtml(c.license);
    console.log(`${escapeHtml(c.what)}: ${escapeHtml(c.author)}, ${license}, <a href="${escapeHtml(c.page)}" rel="noopener">${escapeHtml(c.file.replace(/^File:/, ''))}</a> (${c.kb} KB)`);
  }
}

/**
 * Walks the tree, lays it out as a simple indented list and writes the .mappeora file.
 * `title` is the map's title; `out` the file to write.
 */
function writeMap({ title, tree, out, showCredits }) {
  // Collect the photos first: one API request for all of them.
  const specs = [];
  const collect = ([, , image, , children = []]) => {
    if (isPhoto(image)) specs.push(image);
    children.forEach(collect);
  };
  collect(tree);
  const photos = specs.length ? fetchPhotos(specs) : new Map();

  const nodes = [];
  const edges = [];
  let row = 0;
  const walk = ([label, color, image, link, children = []], depth, parentId) => {
    const id = crypto.randomUUID();
    if (link) row += 0.3;
    const node = { id, label, position: { x: depth * 56, y: Math.round(row * 100) }, color, shape: depth === 0 ? 'ellisse' : 'rettangolo' };
    if (isPhoto(image)) node.image = { kind: 'foto', ref: photos.get(image.photo).ref };
    else if (image) node.image = illustration(image);
    nodes.push(node);
    row++;
    if (parentId) edges.push({ id: crypto.randomUUID(), source: parentId, target: id, ...(link && { label: link }) });
    for (const c of children) walk(c, depth + 1, id);
  };
  walk(tree, 0, null);

  const now = Date.now();
  const file = { format: 'mappeora', version: 1, map: { id: crypto.randomUUID(), title, createdAt: now, updatedAt: now, template: 'libera', nodes, edges } };
  fs.writeFileSync(out, JSON.stringify(file));
  const photoCount = nodes.filter((n) => n.image && n.image.kind === 'foto').length;
  console.log(nodes.length, 'concetti,', edges.length, 'collegamenti,', photoCount, 'foto,', nodes.filter((n) => n.image).length - photoCount, 'illustrazioni,', Math.round(fs.statSync(out).size / 1024), 'KB');
  if (showCredits) printCredits();
}

/** Command line of every generator: <out file> [--credits]. */
function run(title, tree) {
  const out = process.argv[2];
  if (!out) {
    console.error('Usage: node scripts/esempi/<name>.cjs public/esempi/<name>.mappeora [--credits]');
    process.exit(1);
  }
  writeMap({ title, tree, out, showCredits: process.argv.includes('--credits') });
}

module.exports = { WHITE, photo, run };
