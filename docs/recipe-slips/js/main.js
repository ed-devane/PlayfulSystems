// Starts the app and switches between screens.

import * as log from './log.js';
import { startTableView } from './table/tableView.js';
import { startNamesView } from './names/namesView.js';
import { startDrawView, refreshDrawView } from './draw/drawView.js';
import { startSettingsView } from './settingsView.js';
import { startCaptureView } from './photo/captureView.js';
import { startPrinterControls, showPrinterStatus } from './printer/printerControls.js';

function showScreen(name) {
  for (const screen of document.querySelectorAll('.screen')) screen.hidden = screen.id !== `screen-${name}`;
  for (const tab of document.querySelectorAll('nav button')) {
    tab.setAttribute('aria-current', tab.dataset.screen === name ? 'page' : 'false');
  }
  if (name === 'draw') refreshDrawView(); // the table or names may have changed
  showPrinterStatus();
  window.scrollTo(0, 0);
}

log.catchUnexpectedErrors();
for (const tab of document.querySelectorAll('nav button')) {
  tab.addEventListener('click', () => showScreen(tab.dataset.screen));
}
startTableView();
startNamesView();
startSettingsView();
startCaptureView();
startDrawView();
startPrinterControls();
showScreen('table');
