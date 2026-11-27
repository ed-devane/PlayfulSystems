import { test, equal, ok } from './harness.js';
import { tableToCsv, csvToTable, parseCsv } from '../js/table/csv.js';
import { cleanTable, isUnsure, needsMoreItems } from '../js/table/model.js';

const table = {
  columns: [
    { heading: 'Feeling', items: ['stillness', 'unease?', 'play'] },
    { heading: 'Media, form', items: ['sound + light', 'a "quiet" book'] },
    { heading: 'Duration', items: [] },
  ],
};

test('CSV: headings on the first row, columns of different lengths', () => {
  equal(
    tableToCsv(table),
    'Feeling,"Media, form",Duration\r\nstillness,sound + light,\r\nunease?,"a ""quiet"" book",\r\nplay,,\r\n',
  );
});

test('CSV: export then import gives the same table', () => {
  equal(csvToTable(tableToCsv(table)), table);
});

test('CSV: blank words are left out of the export', () => {
  equal(tableToCsv({ columns: [{ heading: 'A', items: ['', ' x ', '  '] }] }), 'A\r\nx\r\n');
});

test('CSV: reads spreadsheet quirks (byte mark, Unix line ends, no final newline)', () => {
  equal(csvToTable('﻿A,B\n1,2\n,3'), {
    columns: [
      { heading: 'A', items: ['1'] },
      { heading: 'B', items: ['2', '3'] },
    ],
  });
});

test('CSV: keeps line breaks inside quotes', () => {
  equal(parseCsv('"one\ntwo",b'), [['one\ntwo', 'b']]);
});

test('CSV: empty or broken files are refused', () => {
  for (const bad of ['', '\n', ',,\n,,', '"never closed']) {
    let threw = false;
    try {
      csvToTable(bad);
    } catch {
      threw = true;
    }
    ok(threw, `should refuse ${JSON.stringify(bad)}`);
  }
});

test('Table: a trailing ? marks a word as unsure', () => {
  ok(isUnsure('unease? '));
  ok(!isUnsure('why? because'));
});

test('Table: warns below 4 filled words', () => {
  ok(needsMoreItems({ items: ['a', 'b', 'c', ' '] }));
  ok(!needsMoreItems({ items: ['a', 'b', 'c', 'd'] }));
});

test('Table: damaged saved data does not break the app', () => {
  equal(cleanTable(null), { columns: [] });
  equal(cleanTable({ columns: [null] }), { columns: [{ heading: '', items: [] }] });
});
