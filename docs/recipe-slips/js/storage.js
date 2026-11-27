// Saving and loading on this device (localStorage).

import * as log from './log.js';

export function load(key, fallback) {
  try {
    const text = localStorage.getItem(key);
    return text === null ? fallback : JSON.parse(text);
  } catch (e) {
    log.error('Couldn’t read saved data, so starting fresh.', e);
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    log.error('Couldn’t save on this phone. Export a CSV to keep your table.', e);
  }
}
