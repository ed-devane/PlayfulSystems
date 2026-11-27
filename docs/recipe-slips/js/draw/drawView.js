// The draw screen: draw, check, and print the slips.

import { STORAGE_KEYS } from '../config.js';
import * as storage from '../storage.js';
import * as log from '../log.js';
import { el } from '../dom.js';
import { saveCsv } from '../download.js';
import { getTable } from '../table/tableView.js';
import { isUnsure } from '../table/model.js';
import { getNames } from '../names/namesView.js';
import { getSettings } from '../settingsView.js';
import { buildSlip } from '../slips/layout.js';
import { printSlips, stopPrinting } from '../printer/printSlips.js';
import { makeDraw, makePartners, redrawOne, drawColumns, usableItems, drawToCsv } from './draw.js';

const byId = (id) => document.getElementById(id);

let state = { pairs: false, draw: null };
let previous = []; // earlier draws, for Undo

const save = () => storage.save(STORAGE_KEYS.draw, state);

function change(draw) {
  if (state.draw) previous.push(state.draw);
  state.draw = draw;
  save();
  refreshDrawView();
}

function drawAll() {
  const names = getNames();
  if (!names.length) return log.error('Add some names on the Names screen first.');
  if (!drawColumns(getTable()).some((c) => usableItems(c).length)) {
    return log.error('The table has no words yet.');
  }
  change(makeDraw(names, getTable(), state.pairs));
  log.info(`Drawn for ${names.length}.`);
}

// Turning pairs on or off keeps everyone's words.
function setPairs(pairs) {
  state.pairs = pairs;
  save();
  if (!state.draw) return;
  const names = state.draw.rows.map((row) => row.name);
  const partners = pairs ? makePartners(names) : names.map(() => []);
  change({ ...state.draw, rows: state.draw.rows.map((row, i) => ({ ...row, partners: partners[i] })) });
}

async function print(indexes, onScreen = false) {
  const settings = getSettings();
  const rows = indexes.map((i) => state.draw.rows[i]);
  const slips = rows.map((row) =>
    buildSlip({
      title: settings.slipTitle,
      footer: settings.slipFooter,
      name: row.name,
      partners: row.partners,
      fields: state.draw.headings.map((label, i) => ({ label, value: row.words[i] })),
    }),
  );
  try {
    await printSlips(slips, settings, {
      names: rows.map((row) => row.name),
      preview: byId('draw-preview'),
      onScreen,
    });
  } catch (e) {
    log.error(e.message, e.cause ?? e);
  }
}

function personRow(row, index) {
  const redraw = el('button', { type: 'button', className: 'small', textContent: 'Redraw' });
  redraw.addEventListener('click', () => {
    try {
      change(redrawOne(state.draw, index, getTable()));
    } catch (e) {
      log.error(e.message, e);
    }
  });
  const printOne = el('button', { type: 'button', className: 'small print-button', textContent: 'Print' });
  printOne.addEventListener('click', () => print([index]));

  const name = el('th', { scope: 'row' }, el('div', { textContent: row.name }));
  if (row.partners.length) {
    name.append(el('div', { className: 'partners', textContent: `with ${row.partners.join(' + ')}` }));
  }
  name.append(el('div', { className: 'row-buttons' }, redraw, printOne));
  return el('tr', {}, name, ...row.words.map((word) => el('td', { textContent: word || '-' })));
}

// Things worth knowing before printing.
function warnings() {
  const table = getTable();
  const list = [];
  const unsure = table.columns.flatMap((c) => c.items).filter(isUnsure).length;
  if (unsure) list.push(`${unsure} ${unsure === 1 ? 'word is' : 'words are'} still marked “?” in the table.`);
  for (const column of drawColumns(table)) {
    if (!usableItems(column).length) list.push(`“${column.heading}” has no words, so slips will show a dash.`);
  }
  if (state.draw) {
    const drawn = state.draw.rows.map((row) => row.name);
    if (JSON.stringify(drawn) !== JSON.stringify(getNames())) {
      list.push('The names have changed since this draw. Press “Redraw all”.');
    }
  }
  return list;
}

export function refreshDrawView() {
  const { draw } = state;
  byId('draw-warnings').replaceChildren(...warnings().map((text) => el('p', { className: 'warning', textContent: text })));
  byId('draw-all').textContent = draw ? 'Redraw all' : 'Draw';
  byId('draw-results').hidden = !draw;
  byId('draw-undo').disabled = previous.length === 0;
  if (!draw) return;
  const head = el('tr', {}, ...['Name', ...draw.headings].map((text) => el('th', { scope: 'col', textContent: text })));
  byId('draw-table').replaceChildren(el('thead', {}, head), el('tbody', {}, ...draw.rows.map(personRow)));
}

export function startDrawView() {
  const saved = storage.load(STORAGE_KEYS.draw, null);
  if (saved && (saved.draw === null || Array.isArray(saved.draw?.rows))) state = saved;

  const pairs = byId('pairs');
  pairs.checked = state.pairs;
  pairs.addEventListener('change', () => setPairs(pairs.checked));
  byId('draw-all').addEventListener('click', drawAll);
  byId('draw-undo').addEventListener('click', () => {
    if (!previous.length) return;
    state.draw = previous.pop();
    state.pairs = pairs.checked = state.draw.rows.some((row) => row.partners.length);
    save();
    refreshDrawView();
  });
  byId('print-all').addEventListener('click', () => print([...state.draw.rows.keys()]));
  byId('preview-all').addEventListener('click', () => print([...state.draw.rows.keys()], true));
  byId('stop-printing').addEventListener('click', stopPrinting);
  byId('export-draw').addEventListener('click', () => saveCsv(drawToCsv(state.draw), 'recipe-draw'));

  refreshDrawView();
}
