// Starts the app and switches between screens.

import * as log from './log.js';
import { startTableView } from './table/tableView.js';
import { startSettingsView } from './settingsView.js';
import { startCaptureView } from './photo/captureView.js';

function showScreen(name) {
  for (const screen of document.querySelectorAll('.screen')) screen.hidden = screen.id !== `screen-${name}`;
  for (const tab of document.querySelectorAll('nav button')) {
    tab.setAttribute('aria-current', tab.dataset.screen === name ? 'page' : 'false');
  }
}

log.catchUnexpectedErrors();
for (const tab of document.querySelectorAll('nav button')) {
  tab.addEventListener('click', () => showScreen(tab.dataset.screen));
}
startTableView();
startSettingsView();
startCaptureView();
showScreen('table');
