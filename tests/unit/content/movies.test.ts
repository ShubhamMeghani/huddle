import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import movies from '../../../content/movies.json';
import { buildMovies, eraOf } from '../../../scripts/build-content';
import { fold } from '@/lib/text';

test('AC-60 at least 200 Bollywood and 200 Hollywood movies', () => {
  expect(movies.filter((m) => m.industry === 'bollywood').length).toBeGreaterThanOrEqual(200);
  expect(movies.filter((m) => m.industry === 'hollywood').length).toBeGreaterThanOrEqual(200);
});

test('AC-60 unique titles per industry, years 1930–2026, era matches year, every era non-empty, difficulty set', () => {
  const keys = movies.map((m) => `${m.industry}|${fold(m.title)}`);
  expect(new Set(keys).size).toBe(movies.length);
  for (const m of movies) {
    expect(m.year, m.title).toBeGreaterThanOrEqual(1930);
    expect(m.year, m.title).toBeLessThanOrEqual(2026);
    expect(m.era, m.title).toBe(eraOf(m.year));
    expect(['easy', 'medium', 'hard']).toContain(m.difficulty);
    expect(m.title.length).toBeGreaterThan(0);
  }
  for (const industry of ['bollywood', 'hollywood'])
    for (const era of ['classic', 'golden', 'modern']) expect(movies.filter((m) => m.industry === industry && m.era === era).length, `${industry} ${era}`).toBeGreaterThan(20);
  expect(buildMovies(readFileSync('content/src/movies.txt', 'utf8'))).toEqual(movies);
});
