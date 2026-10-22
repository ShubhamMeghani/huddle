import { expect, test } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { GAME_META } from '@/games/meta';
import { HowToContent } from '@/client/components/HowTo';
import { GAMES } from '../helpers/drive';

for (const id of GAMES) {
  test(`AC-46 ${id} has How-to-play content with Rules, Scoring and Timers, and the sheet renders all three`, () => {
    const h = GAME_META[id].howTo;
    for (const section of [h.rules, h.scoring, h.timers]) {
      expect(section.length).toBeGreaterThan(0);
      for (const line of section) expect(line.trim().length).toBeGreaterThan(5);
    }
    const html = renderToString(createElement(HowToContent, { gameId: id }));
    for (const t of ['howto-rules', 'howto-scoring', 'howto-timers']) expect(html).toContain(`data-testid="${t}"`);
    expect(html).toContain(h.rules[0].replace(/"/g, '&quot;').slice(0, 20));
  });
}
