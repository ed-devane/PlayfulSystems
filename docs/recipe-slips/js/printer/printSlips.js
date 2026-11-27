// Prints slips: either on the printer, or on screen ("fake printer").

import * as log from '../log.js';
import { drawSlip } from '../slips/render.js';
import { printCanvas } from './connection.js';

function showOnScreen(canvases) {
  const pictures = canvases.map((canvas) =>
    Object.assign(document.createElement('img'), { src: canvas.toDataURL('image/png'), alt: 'Slip preview' }),
  );
  const preview = document.getElementById('preview');
  preview.replaceChildren(...pictures);
  preview.scrollIntoView({ behavior: 'smooth' });
}

// `slips` is a list of slips from buildSlip().
export async function printSlips(slips, settings) {
  const canvases = slips.map((lines) => drawSlip(lines, settings.charsPerLine));
  if (settings.fakePrinter) {
    showOnScreen(canvases);
    log.info('Fake printer: slips shown below. Nothing was sent to the printer.');
    return;
  }
  for (const [i, canvas] of canvases.entries()) {
    await printCanvas(canvas, (done) =>
      log.info(`Printing ${i + 1} of ${canvases.length}: ${Math.round(done * 100)}%`),
    );
  }
  log.info(`Sent ${canvases.length === 1 ? 'the slip' : `${canvases.length} slips`} to the printer.`);
}
