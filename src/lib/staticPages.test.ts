import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import indexHtml from '../../index.html?raw';
import robots from '../../public/robots.txt?raw';
import sitemap from '../../public/sitemap.xml?raw';
import themeInit from '../../public/theme-init.js?raw';
import staticSettings from '../../public/static-settings.js?raw';
import vercelJson from '../../vercel.json?raw';

/** Every static page in public/: the ones search engines and share previews see. */
const pages = import.meta.glob<string>('../../public/*.html', { query: '?raw', import: 'default', eager: true });
const SITE = 'https://mapp-ami.vercel.app';
const STATIC_PAGES = ['mappe-concettuali-dsa.html', 'privacy.html', 'crediti.html'];

const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html');
const meta = (doc: Document, selector: string) => doc.querySelector(selector)?.getAttribute('content') ?? '';

describe('public/*.html', () => {
  const entries = Object.entries(pages).map(([path, html]) => [path.split('/').pop()!, html] as const);

  it('finds the static pages', () => {
    expect(entries.map(([name]) => name).sort()).toEqual([...STATIC_PAGES].sort());
  });

  describe.each(entries)('%s', (name, html) => {
    const doc = parse(html);

    it('is Italian, has a title and a description', () => {
      expect(doc.documentElement.lang).toBe('it');
      expect(doc.title.trim().length).toBeGreaterThan(0);
      expect(doc.title.length).toBeLessThanOrEqual(60);
      expect(meta(doc, 'meta[name=description]').length).toBeGreaterThan(40);
      expect(meta(doc, 'meta[name=description]').length).toBeLessThanOrEqual(170);
    });

    it('has its own canonical address and matching Open Graph tags', () => {
      const canonical = `${SITE}/${name}`;
      expect(doc.querySelector('link[rel=canonical]')?.getAttribute('href')).toBe(canonical);
      expect(meta(doc, 'meta[property="og:url"]')).toBe(canonical);
      expect(meta(doc, 'meta[property="og:title"]')).toBe(doc.title);
      expect(meta(doc, 'meta[property="og:description"]')).toBe(meta(doc, 'meta[name=description]'));
    });

    it('uses no plain http:// links and loads nothing from other sites', () => {
      expect(html).not.toMatch(/http:\/\//);
      // Everything the page loads is on the same site (CSP: script-src 'self').
      for (const el of doc.querySelectorAll('script[src], link[href][rel=stylesheet], img[src]')) {
        expect(el.getAttribute('src') ?? el.getAttribute('href')).not.toMatch(/^(?:https?:)?\/\//);
      }
    });

    it('has no inline script, only data blocks', () => {
      for (const script of doc.querySelectorAll('script:not([src])')) {
        expect(script.getAttribute('type')).toBe('application/ld+json');
      }
    });

    it('takes the look the child chose in the app', () => {
      expect(doc.querySelector('script[src="static-settings.js"][defer]')).not.toBeNull();
    });

    it('has one h1, and a footer that leads to the other pages', () => {
      expect(doc.querySelectorAll('h1')).toHaveLength(1);
      const footerLinks = [...doc.querySelectorAll('footer a')].map((a) => a.getAttribute('href'));
      // The landing page is linked from the footers of privacy and crediti.
      expect(footerLinks).toEqual(expect.arrayContaining(STATIC_PAGES.filter((p) => p !== name)));
    });
  });

  describe('mappe-concettuali-dsa.html', () => {
    const doc = parse(pages['../../public/mappe-concettuali-dsa.html']);

    it('has the promised heading, button and FAQ', () => {
      expect(doc.querySelector('h1')?.textContent).toBe('Mappe concettuali per bambini con DSA e per tutti gli studenti');
      const cta = doc.querySelector('a.cta');
      expect(cta?.textContent?.trim()).toBe('Apri MappAmi');
      expect(cta?.getAttribute('href')).toBe('/');
      expect(doc.body.textContent).toContain('Sì: niente pubblicità e nessun account');
      const questions = [...doc.querySelectorAll('h3')].map((h) => h.textContent);
      expect(questions).toEqual(expect.arrayContaining(['È gratuita?', 'Serve internet?', 'Dove restano le mappe?', 'Funziona con la LIM?', 'Funziona su iPhone e iPad?']));
    });

    it('describes the app in JSON-LD', () => {
      const raw = doc.querySelector('script[type="application/ld+json"]')?.textContent ?? '';
      const data = JSON.parse(raw);
      expect(data).toMatchObject({
        '@type': 'WebApplication',
        name: 'MappAmi',
        url: `${SITE}/`,
        applicationCategory: 'EducationalApplication',
        operatingSystem: 'Web, Android',
        inLanguage: 'it',
        isAccessibleForFree: true,
        offers: { price: '0', priceCurrency: 'EUR' },
        audience: { '@type': 'EducationalAudience', educationalRole: 'student' },
      });
      expect(data.accessibilityFeature.length).toBeGreaterThan(0);
    });

    it('makes no medical promises', () => {
      const text = doc.body.textContent ?? '';
      expect(text).toMatch(/strumento compensativo/);
      expect(text).toContain('Non è una cura né una terapia');
      expect(text).not.toMatch(/guarisc|garant|clinicament|diagnosi|risultati/i);
    });
  });

  describe('privacy.html', () => {
    const html = pages['../../public/privacy.html'];

    it('keeps the two placeholders only the owner can fill', () => {
      expect(html).toContain('[nome del titolare: da completare]');
      expect(html).toContain('[indirizzo email: da completare]');
      expect(html.match(/class="todo"/g)).toHaveLength(2);
    });

    it('says what the app keeps, asks and sends', () => {
      const text = parse(html).body.textContent!.replace(/\s+/g, ' ');
      expect(text).toContain('Ultimo aggiornamento: 18 ottobre 2026');
      expect(text).toContain('legittimo interesse');
      expect(text).toContain('Stati Uniti');
      expect(text).toMatch(/Data Privacy Framework/);
      expect(text).toMatch(/clausole contrattuali standard/);
      expect(text).toContain('hai copiato un’immagine');
      expect(text).toContain('MappAmi tiene sul dispositivo una breve nota tecnica (mai il contenuto delle mappe). Non la manda a nessuno');
    });
  });
});

describe('index.html', () => {
  const doc = parse(indexHtml);

  it('has a short descriptive title and a description', () => {
    expect(doc.title).toBe('MappAmi – mappe concettuali con la voce, anche per DSA');
    expect(doc.title.length).toBeLessThanOrEqual(60);
    const description = meta(doc, 'meta[name=description]');
    expect(description.length).toBeGreaterThan(120);
    expect(description.length).toBeLessThanOrEqual(160);
  });

  it('has the canonical address, Open Graph and Twitter tags', () => {
    expect(doc.querySelector('link[rel=canonical]')?.getAttribute('href')).toBe(`${SITE}/`);
    expect(meta(doc, 'meta[property="og:type"]')).toBe('website');
    expect(meta(doc, 'meta[property="og:site_name"]')).toBe('MappAmi');
    expect(meta(doc, 'meta[property="og:locale"]')).toBe('it_IT');
    expect(meta(doc, 'meta[property="og:title"]')).toBe(doc.title);
    expect(meta(doc, 'meta[property="og:description"]')).toBe(meta(doc, 'meta[name=description]'));
    expect(meta(doc, 'meta[property="og:url"]')).toBe(`${SITE}/`);
    expect(meta(doc, 'meta[property="og:image"]')).toBe(`${SITE}/og-image.png`);
    expect(meta(doc, 'meta[property="og:image:width"]')).toBe('1200');
    expect(meta(doc, 'meta[property="og:image:height"]')).toBe('630');
    expect(meta(doc, 'meta[property="og:image:alt"]').length).toBeGreaterThan(10);
    expect(meta(doc, 'meta[name="twitter:card"]')).toBe('summary_large_image');
  });

  it('keeps the name MappAmi on the home screen and the theme colour', () => {
    expect(meta(doc, 'meta[name=application-name]')).toBe('MappAmi');
    expect(meta(doc, 'meta[name=apple-mobile-web-app-title]')).toBe('MappAmi');
    expect(meta(doc, 'meta[name=theme-color]')).toBe('#fffdf7');
  });

  it('runs theme-init.js before the app, as a classic script', () => {
    const scripts = [...doc.querySelectorAll('script')];
    const init = scripts.findIndex((s) => s.getAttribute('src') === '/theme-init.js');
    const app = scripts.findIndex((s) => s.getAttribute('type') === 'module');
    expect(init).toBeGreaterThanOrEqual(0);
    expect(init).toBeLessThan(app);
    expect(scripts[init].hasAttribute('type')).toBe(false);
    expect(scripts[init].hasAttribute('defer') || scripts[init].hasAttribute('async')).toBe(false);
    // It looks for the theme-color meta: that must already be in the page.
    expect(indexHtml.indexOf('name="theme-color"')).toBeLessThan(indexHtml.indexOf('/theme-init.js'));
    expect(doc.head.contains(scripts[init])).toBe(true);
    expect(doc.querySelectorAll('script:not([src])')).toHaveLength(0); // CSP: script-src 'self'
  });

  it('shows a text-only shell while the app loads, and a message without JavaScript', () => {
    const root = doc.getElementById('root')!;
    expect(root.textContent).toContain('MappAmi');
    expect(root.querySelector('p[role=status]')?.textContent).toBe('Sto caricando…');
    expect(root.querySelector('img, svg, script')).toBeNull();
    const noscript = indexHtml.match(/<noscript>\s*<div[\s\S]*?<\/noscript>/)?.[0] ?? '';
    expect(noscript).toContain('MappAmi ha bisogno di JavaScript per funzionare. Attivalo nel browser e riprova.');
    for (const href of ['/mappe-concettuali-dsa.html', '/privacy.html', '/crediti.html']) expect(noscript).toContain(`href="${href}"`);
  });
});

describe('robots.txt and sitemap.xml', () => {
  it('lets everyone in and points to the sitemap', () => {
    expect(robots).toMatch(/^User-agent: \*$/m);
    expect(robots).toMatch(/^Allow: \/$/m);
    expect(robots).toMatch(new RegExp(`^Sitemap: ${SITE}/sitemap\\.xml$`, 'm'));
  });

  it('lists the home and the static pages', () => {
    const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(urls).toEqual([`${SITE}/`, ...STATIC_PAGES.map((p) => `${SITE}/${p}`)]);
  });
});

describe('vercel.json', () => {
  const headers = JSON.parse(vercelJson).headers as { source: string; headers: { key: string; value: string }[] }[];

  it('keeps the security headers for everything', () => {
    const all = headers.find((h) => h.source === '/(.*)')!;
    expect(all.headers.map((h) => h.key)).toEqual(
      expect.arrayContaining(['Content-Security-Policy', 'X-Content-Type-Options', 'Referrer-Policy', 'X-Frame-Options', 'Permissions-Policy']),
    );
  });

  it('caches the hashed files in /assets for a year', () => {
    const assets = headers.find((h) => h.source === '/assets/(.*)')!;
    expect(assets.headers).toEqual([{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }]);
  });
});

/** Runs a public/*.js file the way a classic script runs, with the page's own globals. */
const run = (code: string) => new Function(code)();

function setSettings(value: unknown) {
  localStorage.setItem('mappeora-settings', typeof value === 'string' ? value : JSON.stringify(value));
}

function resetPage() {
  localStorage.clear();
  const root = document.documentElement;
  for (const { name } of [...root.attributes]) if (name !== 'lang') root.removeAttribute(name);
  root.removeAttribute('style');
  document.head.innerHTML = '<meta name="theme-color" content="#fffdf7">';
}

const themeColor = () => document.querySelector('meta[name=theme-color]')!.getAttribute('content');
const background = () => document.documentElement.style.backgroundColor;
/** jsdom writes colours as rgb(): compare through an element of the same page. */
const asRgb = (hex: string) => {
  const probe = document.createElement('div');
  probe.style.backgroundColor = hex;
  // An empty answer would make every comparison below pass for nothing.
  if (!probe.style.backgroundColor) throw new Error(`jsdom does not understand ${hex}`);
  return probe.style.backgroundColor;
};

describe('theme-init.js', () => {
  beforeEach(resetPage);
  afterEach(resetPage);

  it('is tiny', () => {
    expect(new TextEncoder().encode(themeInit).length).toBeLessThan(1500);
  });

  it('applies everything the child saved', () => {
    setSettings({ state: { theme: 'scuro', font: 'opendyslexic', uppercase: true, wideSpacing: false, textScale: 1.5 }, version: 1 });
    run(themeInit);
    const root = document.documentElement;
    expect(root.dataset.theme).toBe('scuro');
    expect(root.dataset.font).toBe('opendyslexic');
    expect(root.dataset.uppercase).toBe('true');
    expect(root.dataset.spacing).toBe('normal');
    expect(root.style.getPropertyValue('--text-scale')).toBe('1.5');
    expect(themeColor()).toBe('#282d38');
    expect(background()).toBe(asRgb('#1d2129'));
  });

  it.each([
    ['crema', '#fffdf7', '#fdf8ec'],
    ['bianco', '#fff', '#fff'],
    ['azzurro', '#f6fafe', '#eaf3fb'],
    ['scuro', '#282d38', '#1d2129'],
  ])('maps the theme %s to its theme-color and first-paint background', (theme, color, bg) => {
    setSettings({ state: { theme } });
    run(themeInit);
    expect(document.documentElement.dataset.theme).toBe(theme);
    expect(themeColor()).toBe(color);
    expect(background()).toBe(asRgb(bg));
  });

  it('uses the wide spacing and the other fonts too', () => {
    for (const font of ['lexend', 'atkinson', 'sistema']) {
      resetPage();
      setSettings({ state: { font, wideSpacing: true, uppercase: false } });
      run(themeInit);
      expect(document.documentElement.dataset.font).toBe(font);
      expect(document.documentElement.dataset.spacing).toBe('wide');
      expect(document.documentElement.dataset.uppercase).toBe('false');
    }
  });

  it('starts cream, without touching the attributes, when nothing is saved', () => {
    run(themeInit);
    const root = document.documentElement;
    expect(root.hasAttribute('data-theme')).toBe(false);
    expect(root.hasAttribute('data-font')).toBe(false);
    expect(root.style.getPropertyValue('--text-scale')).toBe('');
    expect(themeColor()).toBe('#fffdf7');
    expect(background()).toBe(asRgb('#fdf8ec'));
  });

  it.each([
    ['broken JSON', '{"state": {"theme": "scu'],
    ['not JSON at all', 'scuro'],
    ['JSON null', 'null'],
    ['a number', '42'],
    ['a string', '"scuro"'],
    ['no state', '{"version":1}'],
    ['null state', '{"state":null}'],
    ['a list as state', '{"state":[1,2]}'],
  ])('does not break on %s', (_, stored) => {
    setSettings(stored);
    expect(() => run(themeInit)).not.toThrow();
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(background()).toBe(asRgb('#fdf8ec'));
  });

  it('ignores values it does not know', () => {
    setSettings({ state: { theme: 'neon', font: 'comic', uppercase: 'yes', wideSpacing: 1, textScale: 9 } });
    run(themeInit);
    const root = document.documentElement;
    expect(root.hasAttribute('data-theme')).toBe(false);
    expect(root.hasAttribute('data-font')).toBe(false);
    expect(root.hasAttribute('data-uppercase')).toBe(false);
    expect(root.hasAttribute('data-spacing')).toBe(false);
    expect(root.style.getPropertyValue('--text-scale')).toBe('');
    expect(themeColor()).toBe('#fffdf7');
  });

  it.each([[0.79], [3.01], [-1], ['1.5'], [null], [true]])('refuses the text size %j', (textScale) => {
    setSettings({ state: { textScale } });
    run(themeInit);
    expect(document.documentElement.style.getPropertyValue('--text-scale')).toBe('');
  });

  it.each([[0.8], [1], [1.15], [1.8], [3]])('accepts the text size %j', (textScale) => {
    setSettings({ state: { textScale } });
    run(themeInit);
    expect(document.documentElement.style.getPropertyValue('--text-scale')).toBe(String(textScale));
  });

  it.each(['constructor', '__proto__', 'hasOwnProperty', 'toString'])('does not take the name of an object property (%s) for a theme', (theme) => {
    setSettings({ state: { theme } });
    expect(() => run(themeInit)).not.toThrow();
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(themeColor()).toBe('#fffdf7');
  });

  it('works when the page has no theme-color meta', () => {
    document.head.innerHTML = '';
    setSettings({ state: { theme: 'azzurro' } });
    expect(() => run(themeInit)).not.toThrow();
    expect(document.documentElement.dataset.theme).toBe('azzurro');
  });

  it('works when the storage cannot be read', () => {
    const real = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new DOMException('blocked', 'SecurityError');
    };
    try {
      expect(() => run(themeInit)).not.toThrow();
      expect(background()).toBe(asRgb('#fdf8ec'));
    } finally {
      Storage.prototype.getItem = real;
    }
  });

  it('lets go of the first-paint colours once the page is loaded, so later theme changes are not held back', () => {
    setSettings({ state: { theme: 'scuro' } });
    run(themeInit);
    expect(background()).not.toBe('');
    window.dispatchEvent(new Event('load'));
    expect(document.documentElement.style.background).toBe('');
    expect(document.documentElement.style.backgroundColor).toBe('');
  });
});

describe('static-settings.js', () => {
  beforeEach(resetPage);
  afterEach(resetPage);

  const prop = (name: string) => document.documentElement.style.getPropertyValue(name);

  it('gives the page the colours, font, size, spacing and capitals the child chose', () => {
    setSettings({ state: { theme: 'scuro', font: 'atkinson', textScale: 1.5, wideSpacing: true, uppercase: true } });
    run(staticSettings);
    const root = document.documentElement;
    expect(root.dataset.theme).toBe('scuro');
    expect(prop('--bg')).toBe('#1d2129');
    expect(prop('--card')).toBe('#282d38');
    expect(prop('--text')).toBe('#f1ede4');
    expect(prop('--accent')).toBe('#7fb0e6');
    expect(prop('--accent-text')).toBe('#10161f');
    expect(prop('--font-body')).toMatch(/^'Atkinson Hyperlegible', system-ui/);
    expect(root.style.fontSize).toBe('24px');
    expect(prop('--letter-spacing')).toBe('0.04em');
    expect(prop('--word-spacing')).toBe('0.12em');
    expect(prop('--line-height')).toBe('1.6');
    expect(root.style.textTransform).toBe('uppercase');
  });

  it('knows the four themes of the app', () => {
    const seen = new Set<string>();
    for (const theme of ['crema', 'bianco', 'azzurro', 'scuro']) {
      resetPage();
      setSettings({ state: { theme } });
      run(staticSettings);
      expect(document.documentElement.dataset.theme).toBe(theme);
      for (const name of ['--bg', '--card', '--text', '--muted', '--accent', '--accent-text', '--line']) expect(prop(name)).toMatch(/^#[0-9a-f]{6}$/);
      seen.add(prop('--bg'));
    }
    expect(seen.size).toBe(4);
  });

  it('leaves the page alone when nothing is saved, or the saved look is odd', () => {
    for (const stored of [undefined, 'not json', 'null', '{"state":null}', '{"state":{"theme":"neon","font":"comic","textScale":99,"wideSpacing":"yes","uppercase":1}}']) {
      resetPage();
      if (stored !== undefined) setSettings(stored);
      expect(() => run(staticSettings)).not.toThrow();
      const root = document.documentElement;
      expect(root.hasAttribute('data-theme')).toBe(false);
      expect(root.getAttribute('style') ?? '').toBe('');
    }
  });

  it('does not take an object property for a theme or a font', () => {
    setSettings({ state: { theme: 'constructor', font: '__proto__' } });
    expect(() => run(staticSettings)).not.toThrow();
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(prop('--font-body')).toBe('');
  });

  it('keeps the page’s own spacing when the child chose normal spacing', () => {
    setSettings({ state: { wideSpacing: false, uppercase: false } });
    run(staticSettings);
    expect(prop('--letter-spacing')).toBe('');
    expect(document.documentElement.style.textTransform).toBe('');
  });

  it('works when the storage cannot be read', () => {
    const real = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new DOMException('blocked', 'SecurityError');
    };
    try {
      expect(() => run(staticSettings)).not.toThrow();
    } finally {
      Storage.prototype.getItem = real;
    }
  });

  it('uses the same theme names, values and ranges as the app', () => {
    // The look is defined in theme.css and settingsStore.ts; the static pages repeat it.
    for (const theme of ['crema', 'bianco', 'azzurro', 'scuro']) expect(staticSettings).toContain(`${theme}:`);
    for (const font of ['lexend', 'atkinson', 'opendyslexic', 'sistema']) expect(staticSettings).toContain(`${font}:`);
  });
});
