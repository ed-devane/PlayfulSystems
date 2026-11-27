// The review table on screen: tap any box to edit it.

import { STORAGE_KEYS } from '../config.js';
import * as storage from '../storage.js';
import * as log from '../log.js';
import { cleanTable, emptyTable, newColumn, isUnsure, needsMoreItems, filledItems } from './model.js';
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

// Small helper for making page elements.
function el(tag, properties = {}, ...children) {
  const node = Object.assign(document.createElement(tag), properties);
  node.append(...children);
  return node;
}

function itemRow(column, index, onEdit) {
  // A textarea rather than an input, so that long phrases wrap and can all be read.
  const input = el('textarea', { value: column.items[index], placeholder: 'word', rows: 1, enterKeyHint: 'next' });
  input.setAttribute('aria-label', 'word');
  input.classList.toggle('unsure', isUnsure(input.value));
  input.addEventListener('input', () => {
    column.items[index] = input.value.replaceAll('\n', ' ');
    input.classList.toggle('unsure', isUnsure(input.value));
    save();
    onEdit();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    addItem(column, index + 1);
  });
  const remove = el('button', { type: 'button', className: 'small', textContent: '✕', title: 'Delete word' });
  remove.addEventListener('click', () => {
    remember();
    column.items.splice(index, 1);
    changed();
  });
  return el('li', {}, input, remove);
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
  heading.addEventListener('input', () => {
    column.heading = heading.value;
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

  return el('section', { className: 'column' }, heading, warning, list, add, remove);
}

function render() {
  document.getElementById('columns').replaceChildren(...table.columns.map(columnCard));
  document.getElementById('table-empty').hidden = table.columns.length > 0;
  document.getElementById('undo').disabled = undoStack.length === 0;
}

function exportCsv() {
  if (!table.columns.length) return log.error('The table is empty, so there’s nothing to export.');
  const link = el('a', {
    href: URL.createObjectURL(new Blob([tableToCsv(table)], { type: 'text/csv' })),
    download: `recipe-table-${new Date().toISOString().slice(0, 10)}.csv`,
  });
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  log.info('CSV saved to your downloads.');
}

async function importCsv(file) {
  try {
    const imported = csvToTable(await file.text());
    remember();
    table = imported;
    changed();
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
