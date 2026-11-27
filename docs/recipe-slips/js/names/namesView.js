// The names screen. Names are saved on the phone only.

import { STORAGE_KEYS } from '../config.js';
import * as storage from '../storage.js';
import { parseNames } from './names.js';

let text = '';

export const getNames = () => parseNames(text);

function showCount() {
  const count = getNames().length;
  let line = `${count} ${count === 1 ? 'person' : 'people'}`;
  if (count > 2 && count % 2) line += '. With pairs on, one group will be three.';
  document.getElementById('names-count').textContent = line;
}

export function startNamesView() {
  const box = document.getElementById('names');
  text = String(storage.load(STORAGE_KEYS.names, ''));
  box.value = text;
  box.addEventListener('input', () => {
    text = box.value;
    storage.save(STORAGE_KEYS.names, text);
    showCount();
  });
  showCount();
}
