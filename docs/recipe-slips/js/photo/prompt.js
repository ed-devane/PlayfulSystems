// What we ask the vision model to do. Edit the wording here.

export function buildPrompt({ headingColour = '', itemColour = '', existingHeadings = [] }) {
  const colours = [
    headingColour.trim() && `Notes coloured ${headingColour.trim()} are category headings.`,
    itemColour.trim() && `Notes coloured ${itemColour.trim()} are the words that belong to a category.`,
  ].filter(Boolean);

  const lines = [
    'This photo shows handwritten sticky notes on a white screen, grouped into clusters during a workshop.',
    'Read the notes and return them as categories.',
    '',
    'How to tell headings from words:',
    ...colours.map((c) => `- ${c}`),
    `- ${colours.length ? 'If the colours don’t help or don’t match' : 'Use position'}: treat a note placed above a cluster as its heading, and the notes below it as its words.`,
    '',
    'Rules:',
    '- The categories are not fixed in advance. Follow what is on the screen. Never invent, rename, merge or add categories or words.',
    '- Put each word or phrase under the heading of the cluster it sits in. One note is one entry.',
    '- Transcribe faithfully, keeping the writer’s own spelling. The handwriting may be messy.',
    '- If you are unsure of a note, add "?" to the end of your best reading. If you cannot read it at all, write "?".',
    '- If a cluster has no heading note, use "" as its heading.',
    '- Ignore anything that is not a sticky note.',
  ];

  const known = existingHeadings.map((h) => h.trim()).filter(Boolean);
  if (known.length) {
    lines.push(
      '',
      `This is another photo of the same screen. Headings already read: ${JSON.stringify(known)}.`,
      'Where notes belong to one of these categories, use exactly that heading, even if its heading note is not in this photo.',
    );
  }

  lines.push(
    '',
    'Reply with JSON only, no other text, in exactly this shape:',
    '{"categories":[{"heading":"...","items":["...","..."]}]}',
  );
  return lines.join('\n');
}
