import { test, equal } from './harness.js';
import { pixelsToRows, printSteps, RESET } from '../js/printer/protocol.js';
import { PRINTER } from '../js/config.js';

test('Printer: black dots become 1 bits, leftmost dot first', () => {
  const pixels = new Uint8ClampedArray(384 * 4).fill(255);
  for (const x of [0, 9, 383]) pixels.fill(0, x * 4, x * 4 + 3);
  const [row] = pixelsToRows(pixels, 384, 1);
  equal([row.length, row[0], row[1], row[47]], [48, 0x80, 0x40, 0x01]);
});

test('Printer: tall pictures are sent in blocks of up to 255 rows, then fed', () => {
  const rows = Array.from({ length: 600 }, () => new Uint8Array(48));
  const steps = printSteps(rows);
  const headers = steps.filter((s) => s.bytes[0] === 0x1d && s.bytes.length === 8);
  equal(headers.map((s) => s.bytes[6]), [255, 255, 90]);
  equal([...headers[0].bytes], [0x1d, 0x76, 0x30, 0x00, 48, 0x00, 255, 0x00]);
  equal([...steps[0].bytes], [...RESET]);
  equal([...steps.at(-1).bytes], [0x1b, 0x4a, PRINTER.feedAfterSlipDots]);
  // opening reset, then per block a reset and a header, then the final feed
  const sent = steps.reduce((sum, s) => sum + s.bytes.length, 0);
  equal(sent, RESET.length + 3 * (RESET.length + 8) + 600 * 48 + 3);
});
