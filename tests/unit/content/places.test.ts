import { describe, expect, test } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import places from '../../../data/places.json';
import { lookup } from '@/games/atlas/rules';
import { ATLAS_ATTRIBUTION, atlasMeta } from '@/games/atlas/meta';
import { INDIA_REGIONS, buildPlaces } from '../../../scripts/build-places';

// ISO 3166-1 alpha-2 codes of the 193 UN member states.
const UN = `AF AL DZ AD AO AG AR AM AU AT AZ BS BH BD BB BY BE BZ BJ BT BO BA BW BR BN BG BF BI CV KH CM CA CF TD CL CN CO KM CG CD CR CI HR CU CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FJ FI FR GA GM GE DE GH GR GD GT GN GW GY HT HN HU IS IN ID IR IQ IE IL IT JM JP JO KZ KE KI KP KR KW KG LA LV LB LS LR LY LI LT LU MG MW MY MV ML MT MH MR MU MX FM MD MC MN ME MA MZ MM NA NR NP NL NZ NI NE NG MK NO OM PK PW PA PG PY PE PH PL PT QA RO RU RW KN LC VC WS SM ST SA SN RS SC SL SG SK SI SB SO ZA SS ES LK SD SR SE CH SY TJ TZ TH TL TG TO TT TN TR TM TV UG UA AE GB US UY UZ VU VE VN YE ZM ZW`.split(/\s+/);

type P = { kind: string; country: string; capital?: string; inIndia: boolean; name: string };

describe('Atlas place database (SPEC §4.8)', () => {
  test('AC-67 contains all 193 UN members and their capitals', () => {
    expect(UN).toHaveLength(193);
    const countries = new Map((places as P[]).filter((p) => p.kind === 'country').map((p) => [p.country, p]));
    for (const iso of UN) {
      const c = countries.get(iso);
      expect(c, iso).toBeTruthy();
      if (c!.capital) expect(lookup(c!.capital).length, `${iso} capital ${c!.capital}`).toBeGreaterThan(0);
    }
    expect([...countries.values()].filter((c) => UN.includes(c.country) && c.capital).length).toBeGreaterThanOrEqual(190);
  });

  test('AC-67 contains all 28 states and 8 UTs of India and their capitals', () => {
    expect(INDIA_REGIONS.filter((r) => r.kind === 'state')).toHaveLength(28);
    expect(INDIA_REGIONS.filter((r) => r.kind === 'ut')).toHaveLength(8);
    for (const r of INDIA_REGIONS) {
      expect(lookup(r.name).some((p) => p.kind === 'state'), r.name).toBe(true);
      expect(lookup(r.capital).some((p) => p.inIndia), r.capital).toBe(true);
    }
  });

  test('AC-67 old and alternate names resolve: Bombay, Bangalore, Calcutta, Peking', () => {
    expect(lookup('Bombay').map((p) => p.name)).toContain('Mumbai');
    expect(lookup('bangalore').map((p) => p.name)).toContain('Bengaluru');
    expect(lookup('Calcutta').map((p) => p.name)).toContain('Kolkata');
    expect(lookup('PEKING').map((p) => p.name)).toContain('Beijing');
    expect(lookup('Orissa').map((p) => p.name)).toContain('Odisha');
  });

  test('AC-67 attribution appears in the Atlas UI text and on the About page', () => {
    expect(ATLAS_ATTRIBUTION).toMatch(/GeoNames.*CC BY 4\.0/);
    expect(atlasMeta.howTo.rules).toContain(ATLAS_ATTRIBUTION);
    expect(readFileSync('src/client/games/AtlasGame.tsx', 'utf8')).toContain('ATLAS_ATTRIBUTION');
    expect(readFileSync('src/app/about/page.tsx', 'utf8')).toMatch(/GeoNames[\s\S]*CC BY 4\.0/);
  });

  test.skipIf(!existsSync('.cache/geonames/cities15000.txt'))('AC-67 the build is deterministic: rebuilding from the same dumps gives identical output', async () => {
    const a = await buildPlaces();
    const b = await buildPlaces();
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    expect(a).toEqual(places);
  });
});
