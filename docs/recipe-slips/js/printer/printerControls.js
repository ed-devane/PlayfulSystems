// The "Connect printer" buttons and status lines (on the Draw and Settings screens).

import * as log from '../log.js';
import * as printer from './connection.js';

export function showPrinterStatus() {
  for (const line of document.querySelectorAll('.printer-status')) {
    line.textContent = printer.isConnected() ? 'Printer connected' : 'Printer not connected';
  }
}

async function connect() {
  try {
    log.info('Choose the PeriPage in the list…');
    if (await printer.connect()) log.info('Printer connected.');
    else log.info('No printer chosen. If it isn’t listed, pair it in the phone’s Bluetooth settings.');
  } catch (e) {
    log.error(e.message, e.cause ?? e);
  }
  showPrinterStatus();
}

export function startPrinterControls() {
  for (const button of document.querySelectorAll('.connect')) button.addEventListener('click', connect);
  showPrinterStatus();
}
