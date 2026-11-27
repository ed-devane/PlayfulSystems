import { test, ok } from './harness.js';

const read = async (url) => (await fetch(url, { cache: 'no-cache' })).text();

test('Startup: every file the app uses is on the list in index.html', async () => {
  const root = new URL('../', import.meta.url);
  const page = await read(new URL('index.html', root));
  const listed = page.match(/const files = `([^`]*)`/)[1].trim().split(/\s+/);
  const expected = new Set(listed.map((name) => new URL(`js/${name}.js`, root).href));

  // Follow every import, starting from main.js.
  const found = new Set();
  const queue = [new URL('js/main.js', root).href];
  while (queue.length) {
    const url = queue.pop();
    if (found.has(url)) continue;
    found.add(url);
    for (const [, path] of (await read(url)).matchAll(/from\s+'(\.[^']+)'/g)) queue.push(new URL(path, url).href);
  }

  const missing = [...found].filter((url) => !expected.has(url));
  const extra = [...expected].filter((url) => !found.has(url));
  ok(!missing.length && !extra.length, `not listed: ${missing}\nlisted but unused: ${extra}`);
});
