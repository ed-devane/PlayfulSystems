// The bytes a PeriPage A6 understands. No Bluetooth here, so it can be tested.
//   reset   10 ff fe 01 + 12 x 00   (after connecting, and before each block of rows)
//   raster  1d 76 30 00 <row bytes> 00 <rows, up to 255> 00, then the rows (1 = black)
//   feed    1b 4a <dots>

import { PRINTER, SLIP_STYLE } from '../config.js';

export const RESET = new Uint8Array([0x10, 0xff, 0xfe, 0x01, ...new Array(12).fill(0)]);
const ROW_BYTES = SLIP_STYLE.widthDots / 8;
const MAX_ROWS_PER_BLOCK = 255;

// Turns picture pixels (red, green, blue, alpha...) into rows of one bit per dot.
export function pixelsToRows(pixels, width, height) {
  const rows = [];
  for (let y = 0; y < height; y++) {
    const row = new Uint8Array(ROW_BYTES);
    for (let x = 0; x < Math.min(width, ROW_BYTES * 8); x++) {
      const i = (y * width + x) * 4;
      if (pixels[i] + pixels[i + 1] + pixels[i + 2] < 384) row[x >> 3] |= 0x80 >> (x & 7);
    }
    rows.push(row);
  }
  return rows;
}

// Everything to send for one picture, in order, with the pause to leave after each part.
export function printSteps(rows) {
  const steps = [{ bytes: RESET, pauseMs: 0 }];
  for (let start = 0; start < rows.length; start += MAX_ROWS_PER_BLOCK) {
    const block = rows.slice(start, start + MAX_ROWS_PER_BLOCK);
    steps.push({ bytes: RESET, pauseMs: 0 });
    steps.push({ bytes: new Uint8Array([0x1d, 0x76, 0x30, 0x00, ROW_BYTES, 0x00, block.length, 0x00]), pauseMs: 0 });
    for (let r = 0; r < block.length; r += PRINTER.rowsPerWrite) {
      const part = block.slice(r, r + PRINTER.rowsPerWrite);
      const bytes = new Uint8Array(part.length * ROW_BYTES);
      part.forEach((row, i) => bytes.set(row, i * ROW_BYTES));
      steps.push({ bytes, pauseMs: part.length * PRINTER.rowDelayMs });
    }
  }
  steps.push({ bytes: new Uint8Array([0x1b, 0x4a, PRINTER.feedAfterSlipDots]), pauseMs: PRINTER.pauseAfterSlipMs });
  return steps;
}
