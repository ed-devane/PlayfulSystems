// The settings screen, including connecting the printer and the test print.

import { DEFAULT_SETTINGS, CHARS_PER_LINE_LIMITS, STORAGE_KEYS } from './config.js';
import * as storage from './storage.js';
import * as log from './log.js';
import { buildSlip, SAMPLE_SLIP } from './slips/layout.js';
import * as printer from './printer/connection.js';
import { printSlips } from './printer/printSlips.js';

const settings = { ...DEFAULT_SETTINGS, ...storage.load(STORAGE_KEYS.settings, {}) };

export const getSettings = () => settings;

function clampWidth(value) {
  const { min, max } = CHARS_PER_LINE_LIMITS;
  const number = Math.round(Number(value)) || DEFAULT_SETTINGS.charsPerLine;
  return Math.min(max, Math.max(min, number));
}

// Connects a box on screen to one setting.
function bind(id, key) {
  const input = document.getElementById(id);
  const isTick = input.type === 'checkbox';
  const display = () => {
    if (isTick) input.checked = settings[key];
    else input.value = settings[key];
  };
  display();
  input.addEventListener('change', () => {
    if (isTick) settings[key] = input.checked;
    else if (key === 'charsPerLine') settings[key] = clampWidth(input.value);
    else settings[key] = input.value;
    display();
    storage.save(STORAGE_KEYS.settings, settings);
  });
}

export function startSettingsView() {
  bind('slip-title', 'slipTitle');
  bind('slip-footer', 'slipFooter');
  bind('chars-per-line', 'charsPerLine');
  bind('fake-printer', 'fakePrinter');

  const status = document.getElementById('printer-status');
  const showStatus = () => {
    status.textContent = printer.isConnected() ? 'Printer connected' : 'Printer not connected';
  };

  document.getElementById('connect').addEventListener('click', async () => {
    try {
      log.info('Choose the PeriPage in the list…');
      if (await printer.connect()) log.info('Printer connected.');
      else log.info('No printer chosen. If it isn’t listed, pair it in the phone’s Bluetooth settings.');
    } catch (e) {
      log.error(e.message, e.cause ?? e);
    }
    showStatus();
  });

  document.getElementById('test-print').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const slip = buildSlip(
        { ...SAMPLE_SLIP, title: settings.slipTitle, footer: settings.slipFooter },
        settings.charsPerLine,
      );
      await printSlips([slip], settings);
    } catch (e) {
      log.error(e.message, e.cause ?? e);
    }
    button.disabled = false;
    showStatus();
  });

  showStatus();
}
