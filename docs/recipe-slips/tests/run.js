// Runs every test and lists the results on the page.

import { tests } from './harness.js';
import './table.test.js';
import './slips.test.js';
import './printer.test.js';

let failed = 0;
for (const { name, run } of tests) {
  const item = document.createElement('li');
  try {
    run();
    item.className = 'pass';
    item.textContent = `pass: ${name}`;
  } catch (e) {
    failed++;
    item.className = 'fail';
    item.append(`FAIL: ${name}`, Object.assign(document.createElement('pre'), { textContent: e.message }));
    console.error(name, e);
  }
  document.getElementById('results').append(item);
}
const summary = failed ? `${failed} of ${tests.length} tests FAILED` : `All ${tests.length} tests passed`;
document.getElementById('summary').textContent = summary;
console.log(`[tests] ${summary}`);
