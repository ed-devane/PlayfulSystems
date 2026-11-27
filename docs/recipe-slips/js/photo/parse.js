// Turns the model's answer into a table, and complains clearly if it can't.

const asText = (value) =>
  typeof value === 'string' || typeof value === 'number' ? String(value).replace(/\s+/g, ' ').trim() : '';

export function parseReply(reply) {
  // Models sometimes wrap the JSON in a code block or a sentence, so cut out the { ... } part.
  const start = reply.indexOf('{');
  const end = reply.lastIndexOf('}');
  if (start === -1 || end < start) throw new Error('The model didn’t answer with a table. Try again.');

  let data;
  try {
    data = JSON.parse(reply.slice(start, end + 1));
  } catch (e) {
    throw new Error('The model’s answer was garbled. Try again.', { cause: e });
  }
  if (!Array.isArray(data.categories)) throw new Error('The model’s answer had no categories. Try again.');

  const columns = data.categories
    .map((c) => ({
      heading: asText(c?.heading),
      items: (Array.isArray(c?.items) ? c.items : []).map(asText).filter(Boolean),
    }))
    .filter((c) => c.heading || c.items.length);
  if (!columns.length) throw new Error('No notes were found in the photo. Try a closer, sharper shot.');
  return { columns };
}
