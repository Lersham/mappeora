// Serves dist/ the way Vercel does, so the production headers can be tested
// on a computer: the "headers" of vercel.json are applied to every path that
// matches their "source". No fallback to index.html (Vercel has none here:
// a missing file is a 404).
//
//   node scripts/serve-dist.mjs [--port 4190] [--dir dist]
//
// Used by playwright.csp.config.ts (npm run test:csp).
import { createServer } from 'node:http';
import { readFileSync, statSync, createReadStream } from 'node:fs';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const port = Number(arg('port', '4190'));
const dist = resolve(root, arg('dir', 'dist'));

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  // The example maps and old map files are JSON with their own extension.
  '.mappami': 'application/json; charset=utf-8',
  '.mappeora': 'application/json; charset=utf-8',
};

/**
 * A "source" of vercel.json (path-to-regexp style) as a RegExp. Supports what
 * we use: "/(.*)", "/assets/(.*)", and the usual ":name", ":name*", ":name+".
 */
function sourceToRegExp(source) {
  const body = source
    .replace(/:[A-Za-z_]\w*\*/g, '.*')
    .replace(/:[A-Za-z_]\w*\+/g, '.+')
    .replace(/:[A-Za-z_]\w*/g, '[^/]+');
  return new RegExp(`^${body}$`);
}

const rules = (JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8')).headers ?? []).map((rule) => ({
  match: sourceToRegExp(rule.source),
  headers: rule.headers,
}));

/** Headers for a path: every matching rule, in order; a later rule wins on the same key. */
function headersFor(pathname) {
  const out = new Map();
  for (const rule of rules) {
    if (!rule.match.test(pathname)) continue;
    for (const { key, value } of rule.headers) out.set(key.toLowerCase(), [key, value]);
  }
  return out;
}

function fileFor(pathname) {
  let rel;
  try {
    rel = normalize(decodeURIComponent(pathname));
  } catch {
    return null;
  }
  let file = join(dist, rel);
  // Never outside dist/.
  if (file !== dist && !file.startsWith(dist + sep)) return null;
  try {
    if (statSync(file).isDirectory()) file = join(file, 'index.html');
    return statSync(file).isFile() ? file : null;
  } catch {
    return null;
  }
}

createServer((req, res) => {
  const { pathname } = new URL(req.url ?? '/', 'http://localhost');
  const file = req.method === 'GET' || req.method === 'HEAD' ? fileFor(pathname) : null;
  const headers = headersFor(pathname);
  // Vercel's default for a static file without its own Cache-Control.
  if (!headers.has('cache-control')) headers.set('cache-control', ['Cache-Control', 'public, max-age=0, must-revalidate']);
  for (const [key, value] of headers.values()) res.setHeader(key, value);
  if (!file) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end(req.method === 'HEAD' ? undefined : 'Not found');
  }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
  if (req.method === 'HEAD') return res.end();
  createReadStream(file).pipe(res);
}).listen(port, () => console.log(`dist/ su http://localhost:${port}`));
