// The review table on screen: tap any box to edit it.

import { STORAGE_KEYS } from '../config.js';
import * as storage from '../storage.js';
import * as log from '../log.js';
import { el } from '../dom.js';
import { saveCsv } from '../download.js';
import {
  cleanTable,
  emptyTable,
  newColumn,
  isUnsure,
  canConfirm,
  withoutMark,
  needsMoreItems,
  filledItems,
} from './model.js';
import { tableToCsv, csvToTable } from './csv.js';

let table = emptyTable();
let undoStack = [];

export const getTable = () => table;

const save = () => storage.save(STORAGE_KEYS.table, table);

// Call before anything that removes or replaces words, so it can be undone.
function remember() {
  undoStack.push(structuredClone(table));
  if (undoStack.length > 30) undoStack.shift();
}

function changed() {
  save();
  render();
}

// Swaps in a whole new table (from a photo or a CSV file). Undo brings the old one back.
export function replaceTable(next) {
  remember();
  table = next;
  changed();
}

// The "✓" under a yellow word: it was read correctly, so drop the "?".
function confirmButton(onConfirm) {
  const button = el('button', { type: 'button', className: 'confirm', textContent: '✓ Correct' });
  button.addEventListener('click', () => {
    remember();
    onConfirm();
    changed();
  });
  return button;
}

function itemRow(column, index, onEdit) {
  // A textarea rather than an input, so that long phrases wrap and can all be read.
  const input = el('textarea', { value: column.items[index], placeholder: 'word', rows: 1, enterKeyHint: 'next' });
  input.setAttribute('aria-label', 'word');
  const row = el('li');
  const mark = () => {
    input.classList.toggle('unsure', isUnsure(input.value));
    row.classList.toggle('needs-check', canConfirm(input.value));
  };
  mark();
  input.addEventListener('input', () => {
    column.items[index] = input.value.replaceAll('\n', ' ');
    mark();
    save();
    onEdit();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    addItem(column, index + 1);
  });
  const remove = el('button', { type: 'button', className: 'small remove', textContent: '✕', title: 'Delete word' });
  remove.addEventListener('click', () => {
    remember();
    column.items.splice(index, 1);
    changed();
  });
  const confirm = confirmButton(() => (column.items[index] = withoutMark(column.items[index])));
  row.append(input, remove, confirm);
  return row;
}

function addItem(column, at = column.items.length) {
  column.items.splice(at, 0, '');
  changed();
  const columnIndex = table.columns.indexOf(column);
  document.querySelectorAll('.column')[columnIndex]?.querySelectorAll('li textarea')[at]?.focus();
}

function columnCard(column, index) {
  const heading = el('input', { value: column.heading, placeholder: 'Heading', className: 'heading' });
  heading.setAttribute('aria-label', 'column heading');
  const confirmHeading = confirmButton(() => (column.heading = withoutMark(column.heading)));
  const markHeading = () => {
    heading.classList.toggle('unsure', isUnsure(heading.value));
    confirmHeading.hidden = !canConfirm(heading.value);
  };
  markHeading();
  heading.addEventListener('input', () => {
    column.heading = heading.value;
    markHeading();
    save();
  });

  const warning = el('p', { className: 'warning' });
  const updateWarning = () => {
    warning.hidden = !needsMoreItems(column);
    warning.textContent = `Only ${filledItems(column).length}. Ask the room for more.`;
  };
  updateWarning();

  const list = el('ul', {}, ...column.items.map((_, i) => itemRow(column, i, updateWarning)));

  const add = el('button', { type: 'button', textContent: '+ word' });
  add.addEventListener('click', () => addItem(column));

  const remove = el('button', { type: 'button', className: 'quiet', textContent: 'Delete column' });
  remove.addEventListener('click', () => {
    remember();
    table.columns.splice(index, 1);
    changed();
  });

  return el('section', { className: 'column' }, heading, confirmHeading, warning, list, add, remove);
}

function render() {
  document.getElementById('columns').replaceChildren(...table.columns.map(columnCard));
  document.getElementById('table-empty').hidden = table.columns.length > 0;
  document.getElementById('undo').disabled = undoStack.length === 0;
  document.getElementById('add-photo').hidden = table.columns.length === 0;
}

function exportCsv() {
  if (!table.columns.length) return log.error('The table is empty, so there’s nothing to export.');
  saveCsv(tableToCsv(table), 'recipe-table');
}

async function importCsv(file) {
  try {
    const imported = csvToTable(await file.text());
    replaceTable(imported);
    log.info(`Imported ${imported.columns.length} columns.`);
  } catch (e) {
    log.error(`Couldn’t import that file: ${e.message}`, e);
  }
}

export function startTableView() {
  table = cleanTable(storage.load(STORAGE_KEYS.table, emptyTable()));

  document.getElementById('add-column').addEventListener('click', () => {
    table.columns.push(newColumn());
    changed();
    document.querySelector('.column:last-child .heading')?.focus();
  });
  document.getElementById('undo').addEventListener('click', () => {
    if (!undoStack.length) return;
    table = undoStack.pop();
    changed();
  });
  document.getElementById('clear-table').addEventListener('click', () => {
    if (!table.columns.length) return;
    remember();
    table = emptyTable();
    changed();
    log.info('Table cleared. Press Undo to bring it back.');
  });
  document.getElementById('export-csv').addEventListener('click', exportCsv);
  const picker = document.getElementById('import-file');
  document.getElementById('import-csv').addEventListener('click', () => picker.click());
  picker.addEventListener('change', () => {
    if (picker.files[0]) importCsv(picker.files[0]);
    picker.value = ''; // so the same file can be chosen again
  });

  render();
}
