// The "Take photo" buttons: photo -> vision model -> table.

import * as log from '../log.js';
import { getSettings } from '../settingsView.js';
import { getTable, replaceTable } from '../table/tableView.js';
import { mergeTables } from '../table/merge.js';
import { shrinkPhoto } from './image.js';
import { readNotes } from './openrouter.js';

const byId = (id) => document.getElementById(id);

let mode = 'new'; // 'new' starts a fresh table, 'add' adds to the one on screen
let last = null; // the latest photo, kept so a failed read can be retried

function setBusy(busy) {
  for (const id of ['take-photo', 'add-photo', 'read-again']) byId(id).disabled = busy;
}

function showThumbnail(image) {
  if (mode === 'new') byId('thumbs').replaceChildren();
  const picture = Object.assign(document.createElement('img'), { src: image, alt: 'Photo taken' });
  byId('thumbs').append(picture);
}

async function read() {
  const settings = getSettings();
  if (!settings.apiKey) {
    byId('read-again').hidden = false;
    return log.error('Add your OpenRouter key in Settings, then press Read again.');
  }
  setBusy(true);
  const started = Date.now();
  const tick = () =>
    log.status(`Reading the notes… ${Math.round((Date.now() - started) / 1000)} s (often 10 to 40)`);
  tick();
  const timer = setInterval(tick, 1000);
  try {
    const headings = mode === 'add' ? getTable().columns.map((c) => c.heading) : [];
    const found = await readNotes(last, settings, headings);
    replaceTable(mode === 'add' ? mergeTables(getTable(), found) : found);
    byId('read-again').hidden = true;
    const words = found.columns.reduce((sum, c) => sum + c.items.length, 0);
    log.info(`Read ${words} words in ${found.columns.length} columns. Check the yellow ones. Undo brings back the old table.`);
  } catch (e) {
    byId('read-again').hidden = false;
    log.error(e.message, e.cause ?? e);
  } finally {
    clearInterval(timer);
    setBusy(false);
  }
}

export function startCaptureView() {
  const picker = byId('photo-file');
  const choose = (newMode) => () => {
    mode = newMode;
    picker.click();
  };
  byId('take-photo').addEventListener('click', choose('new'));
  byId('add-photo').addEventListener('click', choose('add'));
  byId('read-again').addEventListener('click', read);

  picker.addEventListener('change', async () => {
    const file = picker.files[0];
    picker.value = ''; // so the same picture can be chosen again
    if (!file) return;
    setBusy(true);
    try {
      last = await shrinkPhoto(file);
    } catch (e) {
      return log.error(e.message, e.cause ?? e);
    } finally {
      setBusy(false);
    }
    showThumbnail(last);
    await read();
  });
}
