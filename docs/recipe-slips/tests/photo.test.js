import { test, equal, ok } from './harness.js';
import { buildPrompt } from '../js/photo/prompt.js';
import { parseReply } from '../js/photo/parse.js';
import { readNotes } from '../js/photo/openrouter.js';
import { mergeTables } from '../js/table/merge.js';
import { DEFAULT_SETTINGS } from '../js/config.js';

const reply = '{"categories":[{"heading":"Feeling","items":["stillness","unease?"]}]}';
const expected = { columns: [{ heading: 'Feeling', items: ['stillness', 'unease?'] }] };

async function failure(run) {
  try {
    await run();
  } catch (e) {
    return e.message;
  }
  throw new Error('expected this to fail');
}

test('Prompt: uses the chosen colours, with position as the fallback', () => {
  const prompt = buildPrompt({ headingColour: 'orange', itemColour: 'blue' });
  ok(prompt.includes('Notes coloured orange are category headings'));
  ok(prompt.includes('Notes coloured blue are the words'));
  ok(prompt.includes('above a cluster'));
});

test('Prompt: blank colours are left out', () => {
  ok(!buildPrompt({ headingColour: ' ', itemColour: '' }).includes('coloured'));
});

test('Prompt: a second photo is told the headings already read', () => {
  ok(buildPrompt({ existingHeadings: ['Feeling', ''] }).includes('["Feeling"]'));
  ok(!buildPrompt({}).includes('already read'));
});

test('Reply: plain JSON, or JSON wrapped in a code block', () => {
  equal(parseReply(reply), expected);
  equal(parseReply(`Here you go:\n\`\`\`json\n${reply}\n\`\`\``), expected);
});

test('Reply: tidies odd entries', () => {
  equal(parseReply('{"categories":[{"heading":null,"items":[" two\\nlines ",90,"",{}]},{}]}'), {
    columns: [{ heading: '', items: ['two lines', '90'] }],
  });
});

test('Reply: bad answers are refused with a message', async () => {
  for (const bad of ['', 'no notes', '{"categories":', '{"other":1}', '{"categories":[]}']) {
    ok(await failure(() => parseReply(bad)));
  }
});

test('Merge: same heading joins up, repeats are skipped, a sure reading wins', () => {
  const merged = mergeTables(
    { columns: [{ heading: 'Feeling', items: ['unease?', 'play', '?'] }] },
    {
      columns: [
        { heading: 'feeling ', items: ['Unease', 'play?', 'joy', '?'] },
        { heading: 'Process', items: ['chance'] },
      ],
    },
  );
  equal(merged, {
    columns: [
      { heading: 'Feeling', items: ['Unease', 'play', '?', 'joy', '?'] },
      { heading: 'Process', items: ['chance'] },
    ],
  });
});

test('Merge: columns without a heading stay separate, and the original is untouched', () => {
  const base = { columns: [{ heading: '', items: ['a'] }] };
  equal(mergeTables(base, { columns: [{ heading: '', items: ['b'] }] }).columns.length, 2);
  equal(base, { columns: [{ heading: '', items: ['a'] }] });
});

const settings = { ...DEFAULT_SETTINGS, apiKey: 'test-key' };
const answering = (status, body) => async () => new Response(JSON.stringify(body), { status });

test('Vision: sends the key, model, picture and prompt, and returns a table', async () => {
  let sent;
  const request = async (url, options) => {
    sent = { url, ...options };
    return new Response(JSON.stringify({ choices: [{ message: { content: reply }, finish_reason: 'stop' }] }));
  };
  equal(await readNotes('data:image/jpeg;base64,AAAA', settings, [], request), expected);
  const body = JSON.parse(sent.body);
  equal(sent.headers.Authorization, 'Bearer test-key');
  equal(body.model, settings.model);
  equal(body.messages[0].content[0].image_url.url, 'data:image/jpeg;base64,AAAA');
  ok(body.messages[0].content[1].text.includes('pink'));
  ok(!sent.body.includes('test-key'), 'the key belongs only in the header');
});

test('Vision: explains a bad key, no credit, no internet and a cut-off answer', async () => {
  const read = (request) => failure(() => readNotes('data:,', settings, [], request));
  ok((await read(answering(401, { error: { message: 'nope' } }))).includes('rejected the key'));
  ok((await read(answering(402, {}))).includes('credit'));
  ok((await read(answering(200, { error: { code: 429 } }))).includes('Too many'));
  ok((await read(async () => Promise.reject(new TypeError('offline')))).includes('Couldn’t reach'));
  ok((await read(answering(200, { choices: [{ finish_reason: 'length' }] }))).includes('cut off'));
});
