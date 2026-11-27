// Prints slips: either on the printer, or on screen ("fake printer").

import * as log from '../log.js';
import { el } from '../dom.js';
import { drawSlip, turnForPrinter } from '../slips/render.js';
import { printCanvas, isConnected } from './connection.js';

let printing = false;
let stopRequested = false;

// Stops after the slip that is printing now.
export function stopPrinting() {
  if (!printing) return;
  stopRequested = true;
  log.info('Stopping after this slip.');
}

function showOnScreen(canvases, preview) {
  preview.replaceChildren(...canvases.map((c) => el('img', { src: c.toDataURL('image/png'), alt: 'Slip preview' })));
  preview.scrollIntoView({ behavior: 'smooth' });
}

// Buttons that start printing are greyed out while it runs; "Stop" appears instead.
function showBusy(busy) {
  for (const button of document.querySelectorAll('.print-button')) button.disabled = busy;
  document.getElementById('stop-printing').hidden = !busy;
}

// `slips` is a list of slips from buildSlip(). `names` are used in messages.
export async function printSlips(slips, settings, { preview, names = [], onScreen = false }) {
  if (printing) throw new Error('Still printing. Wait, or press “Stop printing”.');
  const canvases = slips.map(drawSlip); // upright, as they'll be read
  if (onScreen || settings.fakePrinter) {
    showOnScreen(canvases, preview);
    log.info('Slips shown below. Nothing was sent to the printer.');
    return;
  }
  if (!isConnected()) throw new Error('No printer connected. Press “Connect printer”.');

  printing = true;
  stopRequested = false;
  showBusy(true);
  // A sleeping screen would stall the printing, so keep it awake.
  const awake = await navigator.wakeLock?.request('screen').catch(() => null);
  let done = 0;
  try {
    for (const [i, canvas] of canvases.entries()) {
      if (stopRequested) break;
      const which = `${i + 1} of ${canvases.length}${names[i] ? ` (${names[i]})` : ''}`;
      try {
        await printCanvas(turnForPrinter(canvas), (part) =>
          log.status(`Printing ${which}: ${Math.round(part * 100)}%`),
        );
      } catch (e) {
        throw new Error(`Stopped at slip ${which}. ${e.message}`, { cause: e.cause ?? e });
      }
      done++;
    }
    log.info(`Sent ${done} of ${canvases.length} ${canvases.length === 1 ? 'slip' : 'slips'} to the printer.`);
  } finally {
    awake?.release();
    printing = false;
    showBusy(false);
  }
}
