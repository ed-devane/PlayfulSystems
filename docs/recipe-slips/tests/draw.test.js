import { test, equal, ok } from './harness.js';
import { makeDraw, makePartners, redrawOne, drawToCsv } from '../js/draw/draw.js';
import { parseNames } from '../js/names/names.js';

const table = {
  columns: [
    { heading: 'Feeling', items: ['stillness', 'unease?', 'play', '?', ' '] },
    { heading: 'Process?', items: ['chance', 'weaving'] },
    { heading: 'Duration', items: [] },
    { heading: '', items: [] },
  ],
};
const people = (n) => Array.from({ length: n }, (_, i) => `P${i}`);

test('Names: one per line or separated by commas', () => {
  equal(parseNames(' Ann, Ben\n\nCat ,\r\nDee\n'), ['Ann', 'Ben', 'Cat', 'Dee']);
  equal(parseNames(''), []);
});

test('Draw: one word per column, always from its own column', () => {
  for (let go = 0; go < 200; go++) {
    const { headings, rows } = makeDraw(people(10), table, false);
    equal(headings, ['Feeling', 'Process', 'Duration']);
    for (const { words, partners } of rows) {
      ok(['stillness', 'unease?', 'play'].includes(words[0]), `bad word ${words[0]}`);
      ok(['chance', 'weaving'].includes(words[1]));
      equal(words[2], '', 'an empty column gives nothing');
      equal(partners, []);
    }
  }
});

test('Draw: the first and last words can both be picked', () => {
  equal(makeDraw(['A'], table, false, () => 0).rows[0].words, ['stillness', 'chance', '']);
  equal(makeDraw(['A'], table, false, () => 0.999999).rows[0].words, ['play', 'weaving', '']);
});

test('Pairs: everyone is in exactly one group; odd numbers make one three', () => {
  for (let count = 2; count <= 11; count++) {
    for (let go = 0; go < 50; go++) {
      const names = people(count);
      const partners = makePartners(names);
      const sizes = partners.map((p) => p.length + 1);
      ok(partners.every((p, i) => !p.includes(names[i])), 'nobody partners themselves');
      ok(
        partners.every((p, i) => p.every((other) => partners[names.indexOf(other)].includes(names[i]))),
        'partners agree with each other',
      );
      equal(sizes.filter((s) => s === 3).length, count % 2 ? 3 : 0, `groups of three for ${count}`);
      ok(sizes.every((s) => s === 2 || s === 3));
    }
  }
});

test('Pairs: one person, or nobody, is handled', () => {
  equal(makePartners(['A']), [[]]);
  equal(makePartners([]), []);
});

test('Pairs: two people with the same name still get a partner each', () => {
  equal(makePartners(['Sam', 'Sam']), [['Sam'], ['Sam']]);
});

test('Redraw one: only that person’s words change', () => {
  const draw = makeDraw(people(4), table, true, () => 0);
  const after = redrawOne(draw, 2, table);
  ok(JSON.stringify(after.rows[2].words) !== JSON.stringify(draw.rows[2].words));
  equal(after.rows[2].partners, draw.rows[2].partners);
  for (const i of [0, 1, 3]) equal(after.rows[i], draw.rows[i]);
});

test('Redraw one: refuses if the columns have changed', () => {
  const draw = makeDraw(['A'], table, false);
  let threw = false;
  try {
    redrawOne(draw, 0, { columns: table.columns.slice(1) });
  } catch {
    threw = true;
  }
  ok(threw);
});

test('Draw CSV: partner column only when there are pairs', () => {
  const draw = { headings: ['Feeling'], rows: [{ name: 'A', words: ['calm'], partners: [] }] };
  equal(drawToCsv(draw), 'Name,Feeling\r\nA,calm\r\n');
  draw.rows[0].partners = ['B', 'C'];
  equal(drawToCsv(draw), 'Name,Feeling,Partner\r\nA,calm,B + C\r\n');
});
