// CSV in and out. The first row is the headings; each column's words go underneath.

import { filledItems } from './model.js';

const quote = (cell) => (/[",\r\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell);

export const rowsToCsv = (rows) => rows.map((row) => row.map(quote).join(',')).join('\r\n') + '\r\n';

// Reads CSV text into rows of cells, including quoted cells with commas or line breaks.
export function parseCsv(text) {
  const source = text.replace(/^﻿/, ''); // spreadsheets sometimes add an invisible mark
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (quoted) {
      if (ch !== '"') cell += ch;
      else if (source[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = false;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (quoted) throw new Error('A quotation mark is never closed');
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

export function tableToCsv(table) {
  const words = table.columns.map(filledItems);
  const height = Math.max(0, ...words.map((w) => w.length));
  const rows = [table.columns.map((c) => c.heading.trim())];
  for (let r = 0; r < height; r++) rows.push(words.map((w) => w[r] ?? ''));
  return rowsToCsv(rows);
}

export function csvToTable(text) {
  const [headings, ...rows] = parseCsv(text);
  if (!headings) throw new Error('The file is empty');
  const width = Math.max(headings.length, ...rows.map((r) => r.length));
  const columns = [];
  for (let c = 0; c < width; c++) {
    const heading = (headings[c] ?? '').trim();
    const items = rows.map((r) => (r[c] ?? '').trim()).filter(Boolean);
    if (heading || items.length) columns.push({ heading, items });
  }
  if (!columns.length) throw new Error('No headings or words found');
  return { columns };
}
