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

if (process.argv[1] && /build-content\.ts$/.test(process.argv[1])) {
  const quiz = buildQuiz(readFileSync('content/src/quiz.txt', 'utf8'));
  writeFileSync('content/quiz.json', JSON.stringify(quiz, null, 0).replace(/\},\{/g, '},\n{') + '\n');
  console.log(`quiz.json: ${quiz.length} questions`);
}
