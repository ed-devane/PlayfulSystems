import { test, equal, ok } from './harness.js';
import { wrapText, fieldLines, buildSlip, fitScale, SAMPLE_SLIP } from '../js/slips/layout.js';
import { drawSlip, turnForPrinter } from '../js/slips/render.js';
import { SLIP_STYLE } from '../js/config.js';

test('Wrap: breaks between words at 32 characters', () => {
  equal(wrapText('Make something that can be done in an afternoon.', 32), [
    'Make something that can be done',
    'in an afternoon.',
  ]);
});

test('Wrap: a line of exactly 32 characters stays whole', () => {
  const line = `${'a'.repeat(15)} ${'b'.repeat(16)}`;
  equal(wrapText(line, 32), [line]);
});

test('Wrap: only a word longer than the line is cut', () => {
  equal(wrapText(`hi ${'x'.repeat(40)} yo`, 32), ['hi', 'x'.repeat(32), `${'x'.repeat(8)} yo`]);
});

test('Wrap: keeps typed line breaks and handles empty text', () => {
  equal(wrapText('a\n\nb', 32), ['a', '', 'b']);
  equal(wrapText('', 32), ['']);
});

test('Fields: words line up after the longest label', () => {
  equal(
    fieldLines(
      [
        { label: 'Feeling', value: 'stillness' },
        { label: 'Technology', value: 'accelerometer' },
      ],
      32,
    ),
    ['Feeling:    stillness', 'Technology: accelerometer'],
  );
});

test('Fields: a long answer continues under itself', () => {
  equal(fieldLines([{ label: 'Media', value: 'sound and light and moving paper' }], 24), [
    'Media: sound and light',
    '       and moving paper',
  ]);
});

test('Fields: a very long label or word goes underneath, uncut', () => {
  equal(fieldLines([{ label: 'Feeling', value: 'electroencephalography' }], 24), [
    'Feeling:',
    '  electroencephalography',
  ]);
});

test('Fields: an empty column prints a dash', () => {
  equal(fieldLines([{ label: 'Feeling', value: '' }], 32), ['Feeling: -']);
});

const awkward = {
  title: 'PLAYFUL SYSTEMS '.repeat(4),
  name: 'Maximiliana Featherstonehaugh-Worthington',
  fields: Array.from({ length: 9 }, () => ({ label: 'A very long category heading indeed', value: 'z'.repeat(50) })),
  partners: ['Johnny', 'Alexandria'],
  footer: 'word '.repeat(30),
};

test('Slip: no line is longer than its limit', () => {
  const [who, words] = buildSlip(awkward);
  ok(who.every((l) => l.text.length <= Math.max(SLIP_STYLE.textChars, SLIP_STYLE.nameChars)));
  ok(words.every((l) => l.text.length <= SLIP_STYLE.wordChars));
});

test('Slip: crowded blocks shrink to fit across the paper; roomy ones keep their size', () => {
  const room = SLIP_STYLE.widthDots - SLIP_STYLE.marginDots * 2;
  for (const block of [...buildSlip(awkward), ...buildSlip({ ...SAMPLE_SLIP, title: 'T', footer: 'F' })]) {
    const height = block.reduce((sum, l) => sum + l.px * SLIP_STYLE.lineSpacing, 0) * fitScale(block, room);
    ok(height <= room + 0.001, `block is ${height} dots tall`);
  }
  equal(fitScale([{ text: 'a', px: 20 }], room), 1);
});

test('Slip: name is biggest; partner line only when there is a partner', () => {
  const build = (partners) => buildSlip({ ...SAMPLE_SLIP, partners, title: 'T', footer: 'F' }).flat();
  const slip = build(['Johnny']);
  equal(slip.filter((l) => l.px === SLIP_STYLE.namePx).map((l) => l.text), ['ANDREA']);
  ok(slip.some((l) => l.text === 'Partner: Johnny'));
  ok(!build([]).some((l) => l.text.startsWith('Partner')));
  ok(build(['A', 'B']).some((l) => l.text === 'Partners: A, B'));
});

test('Picture: the slip is as tall as the paper, and turned to the printer’s width', () => {
  const slip = drawSlip(buildSlip({ ...SAMPLE_SLIP, title: 'T', footer: 'F' }));
  const turned = turnForPrinter(slip);
  equal([slip.height, turned.width, turned.height], [384, 384, slip.width]);
  ok(slip.width > slip.height, 'a slip should be longer than it is tall');
});

test('Picture: turning moves the top left corner to the top right, without mirroring', () => {
  const slip = Object.assign(document.createElement('canvas'), { width: 10, height: 4 });
  const c = slip.getContext('2d');
  c.fillStyle = '#000';
  c.fillRect(0, 0, 1, 1);
  const turned = turnForPrinter(slip);
  const alpha = (x, y) => turned.getContext('2d').getImageData(x, y, 1, 1).data[3];
  equal([alpha(3, 0), alpha(0, 0), alpha(3, 9)], [255, 0, 0]);
});
