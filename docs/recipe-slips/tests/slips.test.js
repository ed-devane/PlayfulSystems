import { test, equal, ok } from './harness.js';
import { wrapText, fieldLines, buildSlip, SAMPLE_SLIP } from '../js/slips/layout.js';

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

test('Slip: no line is wider than the paper', () => {
  const awkward = {
    title: 'PLAYFUL SYSTEMS '.repeat(4),
    name: 'Maximiliana Featherstonehaugh-Worthington',
    fields: [{ label: 'A very long category heading indeed', value: 'z'.repeat(50) }],
    partners: ['Johnny', 'Alexandria'],
    footer: 'word '.repeat(30),
  };
  for (const width of [24, 32, 48]) {
    ok(buildSlip(awkward, width).every((l) => l.text.length <= width), `too wide at ${width}`);
  }
});

test('Slip: name is big capitals; partner line only when there is a partner', () => {
  const slip = buildSlip({ ...SAMPLE_SLIP, title: 'T', footer: 'F' }, 32);
  equal(slip.filter((l) => l.big).map((l) => l.text), ['ANDREA']);
  ok(slip.some((l) => l.text === 'Partner: Johnny'));
  const alone = buildSlip({ ...SAMPLE_SLIP, partners: [], title: 'T', footer: 'F' }, 32);
  ok(!alone.some((l) => l.text.startsWith('Partner')));
  const three = buildSlip({ ...SAMPLE_SLIP, partners: ['A', 'B'], title: 'T', footer: 'F' }, 32);
  ok(three.some((l) => l.text === 'Partners: A, B'));
});
