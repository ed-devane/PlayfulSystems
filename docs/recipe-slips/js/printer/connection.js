// The link to the printer, using Web Serial over Bluetooth.
// The chosen printer is remembered until the page is closed or reloaded.

import { PRINTER } from '../config.js';
import { RESET, pixelsToRows, printSteps } from './protocol.js';

let port = null;
let busy = false;

export const canPrint = () => 'serial' in navigator;
export const isConnected = () => Boolean(port?.writable);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function send(steps, onStep = () => {}) {
  const writer = port.writable.getWriter();
  try {
    for (const [i, step] of steps.entries()) {
      await writer.write(step.bytes);
      if (step.pauseMs) await wait(step.pauseMs);
      onStep((i + 1) / steps.length);
    }
  } finally {
    writer.releaseLock();
  }
}

export async function disconnect() {
  const old = port;
  port = null;
  await old?.close().catch(() => {}); // it may already be gone
}

// Must be called from a button press. Returns false if the list was closed without choosing.
export async function connect() {
  if (!canPrint()) {
    throw new Error('This browser can’t reach the printer. Use an up-to-date Chrome.');
  }
  await disconnect();
  let chosen;
  try {
    chosen = await navigator.serial.requestPort();
  } catch (e) {
    if (e.name === 'NotFoundError') return false;
    throw e;
  }
  try {
    await chosen.open({ baudRate: PRINTER.baudRate });
  } catch (e) {
    throw new Error('Couldn’t connect. Is the printer on, paired, and closed in the PeriPage app?', { cause: e });
  }
  port = chosen;
  try {
    await send([{ bytes: RESET, pauseMs: 0 }]);
  } catch (e) {
    await disconnect();
    throw new Error('Connected, but the printer didn’t accept data. Turn it off and on.', { cause: e });
  }
  return true;
}

// Prints one picture. onProgress gets a number from 0 to 1.
export async function printCanvas(canvas, onProgress) {
  if (!isConnected()) throw new Error('No printer connected. Press “Connect printer”.');
  if (busy) throw new Error('Still printing the last one.');
  busy = true;
  try {
    const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    await send(printSteps(pixelsToRows(data, canvas.width, canvas.height)), onProgress);
  } catch (e) {
    await disconnect();
    throw new Error('Lost the printer while printing. Connect it again.', { cause: e });
  } finally {
    busy = false;
  }
}
