// Decides what goes on each line of a slip. No drawing here, so it can be tested.

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
    const value = field.value.trim() || '-';
    const room = width - indent;
    const fitsBeside = indent <= width / 2 && value.split(/\s+/).every((w) => w.length <= room);
    if (fitsBeside) {
      return wrapText(value, room).map((v, n) => (n ? ' ' : labels[i]).padEnd(indent) + v);
    }
    // Too long to sit side by side: put the word underneath its label.
    return [...wrapText(labels[i], width), ...wrapText(value, width - 2).map((v) => `  ${v}`)];
  });
}

// A slip is a list of { text, big }. "big" lines print at double height.
export function buildSlip({ title, name, fields, partners = [], footer }, width) {
  const plain = (text) => wrapText(text, width).map((t) => ({ text: t, big: false }));
  const rule = { text: '-'.repeat(width), big: false };
  const blank = { text: '', big: false };
  const partnerLine = partners.length
    ? plain(`${partners.length > 1 ? 'Partners' : 'Partner'}: ${partners.join(', ')}`)
    : [];
  return [
    ...plain(title),
    rule,
    ...wrapText(name.toUpperCase(), width).map((text) => ({ text, big: true })),
    blank,
    ...fieldLines(fields, width).map((text) => ({ text, big: false })),
    blank,
    ...plain(footer),
    ...partnerLine,
    rule,
  ];
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
