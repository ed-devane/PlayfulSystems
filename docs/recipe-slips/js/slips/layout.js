// Decides what goes on a slip. No drawing here, so it can be tested.
//
// Slips are read lengthways: the paper's width is the slip's height. A slip is a
// list of blocks that sit side by side (who it's for, then the words), and each
// block is a list of lines: { text, px }, where px is the size of the lettering.

import { SLIP_STYLE } from '../config.js';

// Splits text into lines no longer than `width`, breaking between words.
// A word is only cut if it is longer than a whole line.
export function wrapText(text, width) {
  const lines = [];
  for (const paragraph of String(text).split('\n')) {
    let line = '';
    for (let word of paragraph.split(/\s+/).filter(Boolean)) {
      while (word.length > width) {
        if (line) lines.push(line);
        line = '';
        lines.push(word.slice(0, width));
        word = word.slice(width);
      }
      if (!line) line = word;
      else if (line.length + 1 + word.length <= width) line += ` ${word}`;
      else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

// "Feeling:     stillness", with the words lined up in one column.
export function fieldLines(fields, width) {
  const labels = fields.map((f) => `${f.label.trim() || 'Word'}:`);
  const indent = Math.max(0, ...labels.map((l) => l.length)) + 1;
  return fields.flatMap((field, i) => {
    const value = (field.value ?? '').trim() || '-';
    const room = width - indent;
    const fitsBeside = indent <= width / 2 && value.split(/\s+/).every((w) => w.length <= room);
    if (fitsBeside) {
      return wrapText(value, room).map((v, n) => (n ? ' ' : labels[i]).padEnd(indent) + v);
    }
    // Too long to sit side by side: put the word underneath its label.
    return [...wrapText(labels[i], width), ...wrapText(value, width - 2).map((v) => `  ${v}`)];
  });
}

export function buildSlip({ title, name, fields, partners = [], footer }) {
  const { titlePx, namePx, wordPx, nameChars, textChars, wordChars } = SLIP_STYLE;
  const lines = (text, chars, px) => wrapText(text, chars).map((t) => ({ text: t, px }));
  const partner = partners.length
    ? lines(`${partners.length > 1 ? 'Partners' : 'Partner'}: ${partners.join(', ')}`, textChars, titlePx)
    : [];
  const who = [
    ...lines(title, textChars, titlePx),
    ...lines(name.toUpperCase(), nameChars, namePx),
    ...partner,
    { text: '', px: titlePx / 2 },
    ...lines(footer, textChars, titlePx),
  ];
  const words = fieldLines(fields, wordChars).map((text) => ({ text, px: wordPx }));
  return [who, words].filter((block) => block.length);
}

// How much a block must shrink (1 = not at all) to fit across the paper.
export function fitScale(block, roomDots) {
  const needed = block.reduce((sum, line) => sum + line.px * SLIP_STYLE.lineSpacing, 0);
  return Math.min(1, roomDots / needed);
}

export const SAMPLE_SLIP = {
  name: 'Andrea',
  fields: [
    { label: 'Feeling', value: 'stillness' },
    { label: 'Technology', value: 'accelerometer' },
    { label: 'Media', value: 'sound + light' },
    { label: 'Process', value: 'chance' },
    { label: 'Duration', value: '90 seconds' },
  ],
  partners: ['Johnny'],
};
