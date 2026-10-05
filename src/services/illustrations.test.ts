import { describe, expect, it } from 'vitest';
import { FLUENT_COMMIT, illustrationThumbUrl, illustrationUrl, illustrationsFor, searchIllustrations } from './illustrations';
import index from '../data/illustrations.json';

const names = async (q: string) => (await searchIllustrations(q)).slice(0, 5).map((i) => i.name);

describe('illustrations', () => {
  it('finds concepts by Italian name and keyword', async () => {
    expect((await names('vulcano'))[0]).toBe('vulcano');
    expect(await names('Vesuvio')).toContain('vulcano');
    expect(await names('acqua')).toContain('goccia');
    expect(await names('piante')).toContain('pianta in vaso');
  });

  it('finds the subject of a plural first', async () => {
    expect((await names('Le stelle'))[0]).toBe('stella');
    expect(await names('I funghi')).toContain('fungo');
    expect(await names('le api')).toContain('ape');
    expect(await names('i cani')).toContain('cane');
  });

  it('ignores articles and uses all the words of a phrase', async () => {
    const water = (await searchIllustrations('il ciclo dell’acqua')).slice(0, 10).map((i) => i.name);
    expect(water).toContain('goccia');
    expect(await names('Chi?')).not.toContain('chiesa');
    expect(await searchIllustrations('il la di')).toEqual([]);
  });

  it('uses the same Fluent version as the generated index', () => {
    expect(index.commit).toBe(FLUENT_COMMIT);
  });

  it('builds pinned CDN URLs for the 3D image and the light preview', async () => {
    const [drop] = await illustrationsFor(['💧']);
    expect(illustrationUrl(drop.path)).toMatch(/fluentui-emoji@[0-9a-f]{40}\/assets\/Droplet\/3D\/droplet_3d\.png$/);
    expect(illustrationThumbUrl(drop.path)).toMatch(/\/assets\/Droplet\/Color\/droplet_color\.svg$/);
  });
});
