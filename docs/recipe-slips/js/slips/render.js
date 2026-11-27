// Draws a slip as a picture, and turns it sideways for the printer.

import { SLIP_STYLE } from '../config.js';
import { fitScale } from './layout.js';

const newCanvas = (width, height) => Object.assign(document.createElement('canvas'), { width, height });

// The slip the way you read it: as tall as the paper is wide, and as long as it needs.
export function drawSlip(blocks) {
  const { widthDots, fontFamily, fontWeight, lineSpacing, marginDots, endDots, gapDots } = SLIP_STYLE;
  const font = (px) => `${fontWeight} ${px}px ${fontFamily}`;
  const room = widthDots - marginDots * 2;
  const measure = newCanvas(1, 1).getContext('2d');

  const sized = blocks.map((block) => {
    const scale = fitScale(block, room);
    const lines = block.map((line) => ({ text: line.text, px: line.px * scale }));
    const widths = lines.map((line) => {
      measure.font = font(line.px);
      return measure.measureText(line.text).width;
    });
    return {
      lines,
      width: Math.ceil(Math.max(0, ...widths)),
      height: lines.reduce((sum, line) => sum + line.px * lineSpacing, 0),
    };
  });

  const length = sized.reduce((sum, b) => sum + b.width, endDots * 2 + gapDots * (sized.length - 1));
  const canvas = newCanvas(length, widthDots);
  const c = canvas.getContext('2d');
  c.fillStyle = '#fff';
  c.fillRect(0, 0, length, widthDots);
  c.fillStyle = '#000';
  c.textBaseline = 'middle';

  let x = endDots;
  for (const [i, block] of sized.entries()) {
    let y = (widthDots - block.height) / 2;
    for (const line of block.lines) {
      c.font = font(line.px);
      c.fillText(line.text, x, y + (line.px * lineSpacing) / 2);
      y += line.px * lineSpacing;
    }
    x += block.width;
    if (i < sized.length - 1) c.fillRect(x + gapDots / 2 - 1, marginDots, 3, room); // divider
    x += gapDots;
  }
  return canvas;
}

// Rotates the slip a quarter turn, so it runs down the paper.
export function turnForPrinter(slip) {
  const canvas = newCanvas(slip.height, slip.width);
  const c = canvas.getContext('2d', { willReadFrequently: true });
  c.translate(canvas.width, 0);
  c.rotate(Math.PI / 2);
  c.drawImage(slip, 0, 0);
  return canvas;
}
