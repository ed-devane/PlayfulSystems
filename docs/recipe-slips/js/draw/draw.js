// The random draw. No screen code here, so it can be tested.
// A draw is { headings: [], rows: [ { name, words: [], partners: [] } ] }.
// `random` is only replaced in tests.

import { filledItems } from '../table/model.js';
import { rowsToCsv } from '../table/csv.js';

// A note nobody could read ("?") is never drawn.
export const usableItems = (column) => filledItems(column).filter((item) => !/^\?+$/.test(item));

// Columns that appear on slips. A heading with no words stays in, and shows a dash.
export const drawColumns = (table) => table.columns.filter((c) => c.heading.trim() || usableItems(c).length);

const headingsOf = (columns) => columns.map((c) => c.heading.trim().replace(/\?+$/, '').trim());

const pick = (list, random) => list[Math.floor(random() * list.length)] ?? '';

// One word from each column.
const drawWords = (columns, random) => columns.map((c) => pick(usableItems(c), random));

function shuffle(list, random) {
  const result = [...list];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Pairs, with one group of three if the number is odd. Returns each person's partners.
export function makePartners(names, random = Math.random) {
  const order = shuffle([...names.keys()], random);
  const groups = [];
  for (let i = 0; i < order.length; i += 2) groups.push(order.slice(i, i + 2));
  if (groups.length > 1 && groups.at(-1).length === 1) {
    const leftOver = groups.pop();
    groups.at(-1).push(...leftOver);
  }
  const partners = names.map(() => []);
  for (const group of groups) {
    for (const person of group) partners[person] = group.filter((p) => p !== person).map((p) => names[p]);
  }
  return partners;
}

export function makeDraw(names, table, pairs, random = Math.random) {
  const columns = drawColumns(table);
  const partners = pairs ? makePartners(names, random) : names.map(() => []);
  return {
    headings: headingsOf(columns),
    rows: names.map((name, i) => ({ name, words: drawWords(columns, random), partners: partners[i] })),
  };
}

// New words for one person. Everyone else, and the pairs, stay the same.
export function redrawOne(draw, index, table, random = Math.random) {
  const columns = drawColumns(table);
  if (JSON.stringify(headingsOf(columns)) !== JSON.stringify(draw.headings)) {
    throw new Error('The table’s columns have changed. Press “Redraw all”.');
  }
  const old = JSON.stringify(draw.rows[index].words);
  let words = drawWords(columns, random);
  // Try not to hand the same words straight back.
  for (let tries = 0; tries < 20 && JSON.stringify(words) === old; tries++) words = drawWords(columns, random);
  return { ...draw, rows: draw.rows.map((row, i) => (i === index ? { ...row, words } : row)) };
}

export function drawToCsv(draw) {
  const paired = draw.rows.some((row) => row.partners.length);
  return rowsToCsv([
    ['Name', ...draw.headings, ...(paired ? ['Partner'] : [])],
    ...draw.rows.map((row) => [row.name, ...row.words, ...(paired ? [row.partners.join(' + ')] : [])]),
  ]);
}
