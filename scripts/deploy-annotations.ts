/* Turns the results a deploy-checks run appended to docs/deploy-checks.md into GitHub workflow annotations, which are
 * public (job logs and artifacts need sign-in). Usage: git diff -U0 docs/deploy-checks.md | tsx scripts/deploy-annotations.ts */
import { readFileSync } from 'node:fs';

const added = readFileSync(0, 'utf8')
  .split('\n')
  .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
  .map((l) => l.slice(1));

// One annotation per "### " section: its heading is the title, its lines the message.
const sections: { title: string; lines: string[] }[] = [];
for (const line of added) {
  if (line.startsWith('### ')) sections.push({ title: line.slice(4).trim(), lines: [] });
  else if (line.trim() && sections.length) sections[sections.length - 1].lines.push(line.replace(/^[-|]\s*/, '').trim());
}

const escData = (s: string) => s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
const escProp = (s: string) => escData(s).replace(/:/g, '%3A').replace(/,/g, '%2C');

// GitHub keeps at most 10 notices per step; a run writes about 9 sections. Failures also get the Playwright github
// reporter's own error annotations.
for (const s of sections.slice(0, 10)) console.log(`::notice title=${escProp(s.title)}::${escData(s.lines.join('\n'))}`);
if (!sections.length) console.log('::warning title=deploy-checks::No results were recorded in docs/deploy-checks.md');
