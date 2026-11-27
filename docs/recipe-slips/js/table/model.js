// The table is a list of columns: { columns: [ { heading, items: [] } ] }.
// These functions have no screen code, so they can be tested on their own.

import { MIN_ITEMS_PER_COLUMN } from '../config.js';

export const emptyTable = () => ({ columns: [] });

export const newColumn = (heading = '') => ({ heading, items: [] });

// A trailing "?" means "not sure this was read correctly".
export const isUnsure = (item) => item.trim().endsWith('?');

// The word with its "?" taken off, which is what confirming it does.
export const withoutMark = (item) => item.trim().replace(/[\s?]+$/, '');

// A lone "?" has no word to confirm: it needs typing in.
export const canConfirm = (item) => isUnsure(item) && withoutMark(item) !== '';

// The words in a column that are actually filled in.
export const filledItems = (column) => column.items.map((i) => i.trim()).filter(Boolean);

export const needsMoreItems = (column) => filledItems(column).length < MIN_ITEMS_PER_COLUMN;

// Turns anything loaded from storage into a well-formed table.
export function cleanTable(data) {
  if (!data || !Array.isArray(data.columns)) return emptyTable();
  return {
    columns: data.columns.map((c) => ({
      heading: String(c?.heading ?? ''),
      items: Array.isArray(c?.items) ? c.items.map((i) => String(i ?? '')) : [],
    })),
  };
}
