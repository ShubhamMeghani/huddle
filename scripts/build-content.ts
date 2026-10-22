/* Builds content/*.json from content/src sources. Deterministic: same input → byte-identical output. */
import { readFileSync, writeFileSync } from 'node:fs';

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h;
}

const PREFIX: Record<string, string> = {
  bollywood: 'bw',
  hollywood: 'hw',
  cricket: 'cr',
  india_gk: 'in',
  world_gk: 'wo',
  science: 'sc',
  sports: 'sp',
};

export function buildQuiz(src: string) {
  const counters: Record<string, number> = {};
  return src
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith('#'))
    .map((line) => {
      const [category, difficulty, question, correct, ...wrong] = line.split('|').map((x) => x.trim());
      counters[category] = (counters[category] ?? 0) + 1;
      const id = `${PREFIX[category] ?? 'xx'}${String(counters[category]).padStart(3, '0')}`;
      // Deterministic placement of the correct answer among the four options.
      const answer = hash(id + question) % 4;
      const options = [...wrong];
      options.splice(answer, 0, correct);
      return { id, category, difficulty, question, options, answer };
    });
}

export function buildWords(src: string) {
  return src
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith('#'))
    .map((line) => {
      const [word, difficulty, tags] = line.split('|').map((x) => x.trim());
      return { word, difficulty, tags: tags ? tags.split(',').map((t) => t.trim()) : [] };
    });
}

export function buildPairs(src: string) {
  const counters: Record<string, number> = {};
  return src
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith('#'))
    .map((line) => {
      const [category, a, b, ha, hb] = line.split('|').map((x) => x.trim());
      counters[category] = (counters[category] ?? 0) + 1;
      return {
        id: `${category.slice(0, 3)}${String(counters[category]).padStart(2, '0')}`,
        category,
        a,
        b,
        hintsA: ha.split(',').map((x) => x.trim()),
        hintsB: hb.split(',').map((x) => x.trim()),
      };
    });
}

const lines = (rows: unknown[]) => '[\n' + rows.map((r) => JSON.stringify(r)).join(',\n') + '\n]\n';

if (process.argv[1] && /build-content\.ts$/.test(process.argv[1])) {
  const quiz = buildQuiz(readFileSync('content/src/quiz.txt', 'utf8'));
  writeFileSync('content/quiz.json', lines(quiz));
  console.log(`quiz.json: ${quiz.length} questions`);
  const words = buildWords(readFileSync('content/src/draw-words.txt', 'utf8'));
  writeFileSync('content/draw-words.json', lines(words));
  console.log(`draw-words.json: ${words.length} words`);
  const pairs = buildPairs(readFileSync('content/src/imposter-pairs.txt', 'utf8'));
  writeFileSync('content/imposter-pairs.json', lines(pairs));
  console.log(`imposter-pairs.json: ${pairs.length} pairs`);
}
