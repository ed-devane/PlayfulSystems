// Draws a slip as a picture exactly as wide as the printer.

import { SLIP_STYLE } from '../config.js';

export function drawSlip(lines, charsPerLine) {
  const { widthDots, fontFamily, fontWeight, lineSpacing, paddingDots } = SLIP_STYLE;
  const canvas = document.createElement('canvas');
  const measure = canvas.getContext('2d');

  // Pick the font size at which `charsPerLine` characters fill the paper.
  measure.font = `${fontWeight} 100px ${fontFamily}`;
  const size = (100 * widthDots) / measure.measureText('0'.repeat(charsPerLine)).width;
  const lineHeight = Math.round(size * lineSpacing);
  const heightOf = (line) => (line.big ? lineHeight * 2 : lineHeight);

  canvas.width = widthDots;
  canvas.height = lines.reduce((sum, line) => sum + heightOf(line), paddingDots * 2);

  const c = canvas.getContext('2d', { willReadFrequently: true });
  c.fillStyle = '#fff';
  c.fillRect(0, 0, canvas.width, canvas.height);
  c.fillStyle = '#000';
  c.font = `${fontWeight} ${size}px ${fontFamily}`;
  c.textBaseline = 'top';

  let y = paddingDots;
  for (const line of lines) {
    c.save();
    c.translate(0, y);
    if (line.big) c.scale(1, 2);
    c.fillText(line.text, 0, 0, widthDots);
    c.restore();
    y += heightOf(line);
  }
  return canvas;
}
