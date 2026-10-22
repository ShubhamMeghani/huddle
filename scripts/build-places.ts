/* Builds data/places.json for Atlas from GeoNames dumps (CC BY 4.0, https://www.geonames.org/).
 * Includes: all countries and their capitals; Indian states and UTs (with capitals and old names);
 * Indian cities ≥ 15 000 people; world cities ≥ 100 000 people (decision Q5). Latin-script alternate
 * names only. Deterministic: the same dumps produce byte-identical output. Dumps are cached in .cache/. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const CACHE = '.cache/geonames';
const BASE = 'https://download.geonames.org/export/dump';

export interface Place {
  id: string;
  name: string;
  alt: string[];
  kind: 'country' | 'capital' | 'state' | 'city';
  country: string;
  inIndia: boolean;
  capital?: string;
}

export const ATTRIBUTION = 'Place data © GeoNames (geonames.org), licensed under CC BY 4.0';

/** India's 28 states and 8 union territories with capitals and common alternate names. */
export const INDIA_REGIONS: { name: string; kind: 'state' | 'ut'; capital: string; alt?: string[] }[] = [
  { name: 'Andhra Pradesh', kind: 'state', capital: 'Amaravati' },
  { name: 'Arunachal Pradesh', kind: 'state', capital: 'Itanagar' },
  { name: 'Assam', kind: 'state', capital: 'Dispur' },
  { name: 'Bihar', kind: 'state', capital: 'Patna' },
  { name: 'Chhattisgarh', kind: 'state', capital: 'Raipur', alt: ['Chattisgarh'] },
  { name: 'Goa', kind: 'state', capital: 'Panaji', alt: ['Panjim'] },
  { name: 'Gujarat', kind: 'state', capital: 'Gandhinagar' },
  { name: 'Haryana', kind: 'state', capital: 'Chandigarh' },
  { name: 'Himachal Pradesh', kind: 'state', capital: 'Shimla', alt: ['Simla'] },
  { name: 'Jharkhand', kind: 'state', capital: 'Ranchi' },
  { name: 'Karnataka', kind: 'state', capital: 'Bengaluru', alt: ['Mysore State'] },
  { name: 'Kerala', kind: 'state', capital: 'Thiruvananthapuram' },
  { name: 'Madhya Pradesh', kind: 'state', capital: 'Bhopal' },
  { name: 'Maharashtra', kind: 'state', capital: 'Mumbai' },
  { name: 'Manipur', kind: 'state', capital: 'Imphal' },
  { name: 'Meghalaya', kind: 'state', capital: 'Shillong' },
  { name: 'Mizoram', kind: 'state', capital: 'Aizawl' },
  { name: 'Nagaland', kind: 'state', capital: 'Kohima' },
  { name: 'Odisha', kind: 'state', capital: 'Bhubaneswar', alt: ['Orissa'] },
  { name: 'Punjab', kind: 'state', capital: 'Chandigarh' },
  { name: 'Rajasthan', kind: 'state', capital: 'Jaipur' },
  { name: 'Sikkim', kind: 'state', capital: 'Gangtok' },
  { name: 'Tamil Nadu', kind: 'state', capital: 'Chennai', alt: ['Madras State'] },
  { name: 'Telangana', kind: 'state', capital: 'Hyderabad' },
  { name: 'Tripura', kind: 'state', capital: 'Agartala' },
  { name: 'Uttar Pradesh', kind: 'state', capital: 'Lucknow' },
  { name: 'Uttarakhand', kind: 'state', capital: 'Dehradun', alt: ['Uttaranchal'] },
  { name: 'West Bengal', kind: 'state', capital: 'Kolkata' },
  { name: 'Andaman and Nicobar Islands', kind: 'ut', capital: 'Port Blair', alt: ['Andaman and Nicobar', 'Andamans'] },
  { name: 'Chandigarh', kind: 'ut', capital: 'Chandigarh' },
  { name: 'Dadra and Nagar Haveli and Daman and Diu', kind: 'ut', capital: 'Daman', alt: ['Dadra and Nagar Haveli', 'Daman and Diu'] },
  { name: 'Delhi', kind: 'ut', capital: 'New Delhi', alt: ['NCT of Delhi', 'National Capital Territory of Delhi'] },
  { name: 'Jammu and Kashmir', kind: 'ut', capital: 'Srinagar', alt: ['Jammu & Kashmir', 'Kashmir'] },
  { name: 'Ladakh', kind: 'ut', capital: 'Leh' },
  { name: 'Lakshadweep', kind: 'ut', capital: 'Kavaratti', alt: ['Laccadive Islands'] },
  { name: 'Puducherry', kind: 'ut', capital: 'Puducherry', alt: ['Pondicherry', 'Pondy'] },
];

/** Well-known former or common names GeoNames may not list as alternates. */
const EXTRA_ALIASES: Record<string, string[]> = {
  'IN:Mumbai': ['Bombay'],
  'IN:Kolkata': ['Calcutta'],
  'IN:Chennai': ['Madras'],
  'IN:Bengaluru': ['Bangalore'],
  'IN:Pune': ['Poona'],
  'IN:Thiruvananthapuram': ['Trivandrum'],
  'IN:Kochi': ['Cochin'],
  'IN:Varanasi': ['Banaras', 'Benares', 'Kashi'],
  'IN:Gurugram': ['Gurgaon'],
  'IN:Mysuru': ['Mysore'],
  'IN:Prayagraj': ['Allahabad'],
  'CN:Beijing': ['Peking'],
  'MM:Yangon': ['Rangoon'],
  'VN:Ho Chi Minh City': ['Saigon'],
};

const LATIN = /^[\p{Script=Latin}\p{M}0-9\s'’.\-()&]+$/u;

async function download(file: string): Promise<string> {
  mkdirSync(CACHE, { recursive: true });
  const path = `${CACHE}/${file}`;
  if (!existsSync(path)) {
    const res = await fetch(`${BASE}/${file}`);
    if (!res.ok) throw new Error(`download ${file}: ${res.status}`);
    writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  }
  return path;
}

function unzip(path: string, inner: string): string {
  const out = `${CACHE}/${inner}`;
  if (!existsSync(out)) {
    const r = spawnSync('unzip', ['-o', path, '-d', CACHE], { stdio: 'ignore' });
    if (r.status !== 0) spawnSync('tar', ['-xf', path, '-C', CACHE], { stdio: 'ignore' });
  }
  return readFileSync(out, 'utf8');
}

/** Latin-script alternates, curated aliases first; drops codes like "BOM" and very long names. */
function cleanAlts(name: string, priority: string[], raw: string[]): string[] {
  const seen = new Set([name.toLowerCase()]);
  const out: string[] = [];
  for (const a of [...priority, ...raw.slice().sort()]) {
    const t = a.trim();
    if (!t || t.length > 40 || !LATIN.test(t) || /\d/.test(t) || /^[A-Z]{2,4}$/.test(t)) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out.slice(0, 12);
}

export async function buildPlaces(): Promise<Place[]> {
  const countryInfo = readFileSync(await download('countryInfo.txt'), 'utf8');
  const cities = unzip(await download('cities15000.zip'), 'cities15000.txt');

  const places: Place[] = [];
  const byKey = new Map<string, Place>();
  const add = (p: Place) => {
    const key = `${p.kind}:${p.country}:${p.name.toLowerCase()}`;
    if (byKey.has(key)) return byKey.get(key)!;
    byKey.set(key, p);
    places.push(p);
    return p;
  };

  // Countries (sovereign states and territories) and their capitals.
  const capitals: { name: string; country: string }[] = [];
  for (const line of countryInfo.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const f = line.split('\t');
    const [iso, , , , name, capital] = f;
    if (!iso || !name) continue;
    add({ id: `country:${iso}`, name, alt: [], kind: 'country', country: iso, inIndia: iso === 'IN', ...(capital ? { capital } : {}) });
    if (capital) capitals.push({ name: capital, country: iso });
  }

  // Cities.
  const cityByName = new Map<string, Place>();
  for (const line of cities.split('\n')) {
    if (!line) continue;
    const f = line.split('\t');
    const [geonameid, name, ascii, alternates, , , , , country, , , , , , population] = f;
    const pop = Number(population);
    const india = country === 'IN';
    if (!(india ? pop >= 15_000 : pop >= 100_000)) continue;
    const extra = EXTRA_ALIASES[`${country}:${name}`] ?? [];
    const p = add({
      id: `city:${geonameid}`,
      name,
      alt: cleanAlts(name, [...extra, ascii], alternates ? alternates.split(',') : []),
      kind: 'city',
      country,
      inIndia: india,
    });
    cityByName.set(`${country}:${name.toLowerCase()}`, p);
    for (const a of p.alt) if (!cityByName.has(`${country}:${a.toLowerCase()}`)) cityByName.set(`${country}:${a.toLowerCase()}`, p);
  }
  // Capitals that are not already in the city list (small capitals) become their own entries.
  for (const c of capitals) {
    if (!cityByName.has(`${c.country}:${c.name.toLowerCase()}`)) {
      add({ id: `capital:${c.country}`, name: c.name, alt: [], kind: 'capital', country: c.country, inIndia: c.country === 'IN' });
    }
  }

  // Indian states, UTs and their capitals.
  for (const r of INDIA_REGIONS) {
    add({
      id: `in-region:${r.name.toLowerCase().replace(/[^a-z]+/g, '-')}`,
      name: r.name,
      alt: cleanAlts(r.name, r.alt ?? [], []),
      kind: 'state',
      country: 'IN',
      inIndia: true,
    });
    if (!cityByName.has(`IN:${r.capital.toLowerCase()}`)) {
      const p = add({ id: `in-capital:${r.capital.toLowerCase().replace(/[^a-z]+/g, '-')}`, name: r.capital, alt: [], kind: 'city', country: 'IN', inIndia: true });
      cityByName.set(`IN:${r.capital.toLowerCase()}`, p);
    }
  }

  return places.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

if (process.argv[1] && /build-places\.ts$/.test(process.argv[1])) {
  buildPlaces().then((places) => {
    mkdirSync('data', { recursive: true });
    writeFileSync('data/places.json', '[\n' + places.map((p) => JSON.stringify(p)).join(',\n') + '\n]\n');
    const kinds = places.reduce<Record<string, number>>((m, p) => ((m[p.kind] = (m[p.kind] ?? 0) + 1), m), {});
    console.log(`data/places.json: ${places.length} places`, kinds);
  });
}
