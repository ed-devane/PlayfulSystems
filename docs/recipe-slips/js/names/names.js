// One name per line. Commas work too, so a pasted list is fine.

export const parseNames = (text) =>
  String(text)
    .split(/[\n,;]+/)
    .map((name) => name.trim())
    .filter(Boolean);
