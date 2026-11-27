// The settings screen, including connecting the printer and the test print.

import { DEFAULT_SETTINGS, STORAGE_KEYS } from './config.js';
import * as storage from './storage.js';
import * as log from './log.js';
import { buildSlip, SAMPLE_SLIP } from './slips/layout.js';
import { printSlips } from './printer/printSlips.js';
import { showPrinterStatus } from './printer/printerControls.js';

const settings = { ...DEFAULT_SETTINGS, ...storage.load(STORAGE_KEYS.settings, {}) };

export const getSettings = () => settings;

// Connects a box on screen to one setting.
function bind(id, key) {
  const input = document.getElementById(id);
  const isTick = input.type === 'checkbox';
  const display = () => {
    if (isTick) input.checked = settings[key];
    else input.value = settings[key];
  };
  display();
  const store = () => {
    if (isTick) settings[key] = input.checked;
    else if (key === 'apiKey') settings[key] = input.value.trim();
    else if (key === 'model') settings[key] = input.value.trim() || DEFAULT_SETTINGS.model;
    else settings[key] = input.value;
    storage.save(STORAGE_KEYS.settings, settings);
  };
  input.addEventListener('change', () => {
    store();
    display();
  });
  // The key is saved the moment it's pasted, without needing to tap anywhere else.
  if (key === 'apiKey') {
    input.addEventListener('input', () => {
      store();
      showKeyStatus();
    });
  }
}

// Says whether a key is saved, without showing it.
function showKeyStatus() {
  const line = document.getElementById('key-status');
  if (!line) return;
  const key = settings.apiKey;
  if (!key) line.textContent = 'No key saved yet.';
  else if (!key.startsWith('sk-or-')) line.textContent = 'Saved, but OpenRouter keys start with “sk-or-”. Check it.';
  else line.textContent = `Key saved on this device (ends ${key.slice(-4)}).`;
}

export function startSettingsView() {
  bind('api-key', 'apiKey');
  showKeyStatus();
  bind('model', 'model');
  bind('heading-colour', 'headingColour');
  bind('item-colour', 'itemColour');
  bind('slip-title', 'slipTitle');
  bind('slip-footer', 'slipFooter');
  bind('fake-printer', 'fakePrinter');

  document.getElementById('test-print').addEventListener('click', async () => {
    try {
      const slip = buildSlip({ ...SAMPLE_SLIP, title: settings.slipTitle, footer: settings.slipFooter });
      await printSlips([slip], settings, { preview: document.getElementById('preview') });
    } catch (e) {
      log.error(e.message, e.cause ?? e);
    }
    showPrinterStatus();
  });
}
