// Saves a CSV file to the phone's downloads.

import * as log from './log.js';
import { el } from './dom.js';

export function saveCsv(text, name) {
  const link = el('a', {
    href: URL.createObjectURL(new Blob([text], { type: 'text/csv' })),
    download: `${name}-${new Date().toISOString().slice(0, 10)}.csv`,
  });
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  log.info('CSV saved to your downloads.');
}
