#!/usr/bin/env node
/**
 * Builds src/data/illustrations.json: the Fluent Emoji illustrations
 * (Microsoft, MIT licence) with Italian names and keywords from Unicode CLDR,
 * so the picker can search in Italian without any server.
 *
 *   node scripts/build-illustrations.mjs
 *
 * Needs git and network access. The output is committed: the app build
 * does not run this script.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Pinned so that image URLs never change under existing maps.
// Keep in sync with FLUENT_COMMIT in src/services/illustrations.ts.
export const FLUENT_COMMIT = '1ffb34c752ecf5d402f04cfb4b392c77f57c54bc';
const CLDR_VERSION = '48.2.0';
const OUT = new URL('../src/data/illustrations.json', import.meta.url);

/** Not for a school app. */
const BLOCKED = new Set(['🖕', '🚬', '🔞']);

const VS16 = /️/g;

async function cldr(pkg, dir, key) {
  const url = `https://cdn.jsdelivr.net/npm/${pkg}@${CLDR_VERSION}/${dir}/it/annotations.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const data = (await res.json())[key].annotations;
  // Index without variation selectors: Fluent and CLDR don't always agree.
  return new Map(Object.entries(data).map(([k, v]) => [k.replace(VS16, ''), v]));
}

const work = mkdtempSync(join(tmpdir(), 'fluent-'));
try {
  const repo = join(work, 'repo');
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', maxBuffer: 1e8 });
  execFileSync('git', ['init', '-q', repo]);
  git('remote', 'add', 'origin', 'https://github.com/microsoft/fluentui-emoji.git');
  git('config', 'core.sparseCheckout', 'true');
  writeFileSync(join(repo, '.git/info/sparse-checkout'), '/assets/*/metadata.json\n');
  git('fetch', '-q', '--depth', '1', '--filter=blob:none', 'origin', FLUENT_COMMIT);
  git('checkout', '-q', 'FETCH_HEAD');
  const files = new Set(git('ls-tree', '-r', '--name-only', 'HEAD', 'assets').split('\n'));

  const annotations = await cldr('cldr-annotations-full', 'annotations', 'annotations');
  const derived = await cldr('cldr-annotations-derived-full', 'annotationsDerived', 'annotationsDerived');

  const items = [];
  const folders = [...new Set([...files].filter((f) => f.endsWith('/metadata.json')).map((f) => f.split('/')[1]))];
  for (const folder of folders.sort()) {
    const meta = JSON.parse(readFileSync(join(repo, 'assets', folder, 'metadata.json'), 'utf8'));
    const glyph = meta.glyph;
    if (!glyph || BLOCKED.has(glyph.replace(VS16, ''))) continue;
    // People come in skin tones: we use the neutral "Default" one.
    const base = meta.unicodeSkintones ? `${folder}/Default` : folder;
    const png = [...files].find((f) => f.startsWith(`assets/${base}/3D/`) && f.endsWith('.png'));
    if (!png) continue;
    const svg = png.replace('/3D/', '/Color/').replace('_3d', '_color').replace(/\.png$/, '.svg');
    if (!files.has(svg)) continue;
    const it = annotations.get(glyph.replace(VS16, '')) ?? derived.get(glyph.replace(VS16, ''));
    if (!it?.tts?.[0]) continue;
    const keywords = [...new Set((it.default ?? []).map((k) => k.toLowerCase()))].filter((k) => k !== it.tts[0].toLowerCase());
    items.push({ g: glyph, n: it.tts[0], k: keywords, p: png.slice('assets/'.length, -'.png'.length) });
  }
  writeFileSync(OUT, JSON.stringify({ commit: FLUENT_COMMIT, items }) + '\n');
  console.log(`${items.length} illustrazioni → ${OUT.pathname}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
