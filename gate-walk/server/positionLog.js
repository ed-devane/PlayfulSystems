// Saves every position to a CSV file, one new file each time the server starts.

import fs from 'node:fs';
import path from 'node:path';
import { log } from './log.js';

const HEADINGS = 'received_at,phone_time,id,name,source,lat,lon,accuracy_m';

// Quotes text for CSV, and stops a spreadsheet treating a name as a formula.
export function csvText(value) {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function createPositionLog(folder) {
  fs.mkdirSync(folder, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(':', '-').slice(0, 19);
  const file = path.join(folder, `positions-${stamp}.csv`);
  fs.writeFileSync(file, `${HEADINGS}\n`);
  let failing = false;

  return {
    file,
    write(p, receivedAt = new Date()) {
      const row = [
        receivedAt.toISOString(),
        new Date(p.t).toISOString(),
        p.id,
        csvText(p.name),
        p.source,
        p.lat,
        p.lon,
        p.accuracy,
      ].join(',');
      try {
        fs.appendFileSync(file, `${row}\n`);
        failing = false;
      } catch (error) {
        // Say it once, not once per position. Often the file is open in Excel.
        if (!failing) log.error(`Can't write to ${file} (${error.code}). Is it open in another program?`);
        failing = true;
      }
    },
  };
}
