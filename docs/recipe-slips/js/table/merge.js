// Adds the words from a second photo to the table, without doubling up.

import { newColumn, isUnsure } from './model.js';

// "Unease?" and "unease " count as the same word.
const key = (text) => text.trim().replace(/\?+$/, '').trim().toLowerCase();

export function mergeTables(base, extra) {
  const columns = base.columns.map((c) => ({ heading: c.heading, items: [...c.items] }));
  for (const incoming of extra.columns) {
    // Columns without a heading are never assumed to be the same one.
    let target = key(incoming.heading) && columns.find((c) => key(c.heading) === key(incoming.heading));
    if (!target) {
      target = newColumn(incoming.heading);
      columns.push(target);
    }
    for (const item of incoming.items) {
      const found = key(item) ? target.items.findIndex((existing) => key(existing) === key(item)) : -1;
      if (found === -1) target.items.push(item);
      else if (isUnsure(target.items[found]) && !isUnsure(item)) target.items[found] = item;
    }
  }
  return { columns };
}
