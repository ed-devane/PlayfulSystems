// Starts the real server on spare ports and talks to it like the pages do.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import WebSocket from 'ws';
import { startApp } from '../server/app.js';
import config from '../server/config.js';

const status = (port, address, headers = {}) =>
  new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path: address, headers }, (response) => {
      response.resume();
      resolve(response.statusCode);
    }).on('error', reject);
  });

const waitFor = (socket, wanted) =>
  new Promise((resolve, reject) => {
    socket.on('message', (data) => {
      const message = JSON.parse(data);
      if (wanted(message)) resolve(message);
    });
    socket.on('error', reject);
  });

test('a position sent by a walker reaches the map and the log', async (t) => {
  const logFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'gatewalk-'));
  const app = await startApp({ ...config, walkerPort: 0, mapPort: 0, mapRefreshMs: 50, logFolder });
  t.after(async () => {
    await app.close();
    fs.rmSync(logFolder, { recursive: true, force: true });
  });
  const local = `localhost:${app.mapPort}`;

  await t.test('serves each page', async () => {
    for (const address of ['/?sim=1', '/main.js', '/shared/link.js', '/vendor/leaflet/leaflet.js']) {
      assert.equal(await status(app.walkerPort, address), 200, address);
    }
    assert.equal(await status(app.mapPort, '/', { host: local }), 200);
    assert.equal(await status(app.mapPort, '/markers.js', { host: local }), 200);
  });

  await t.test('keeps the map and other files private', async () => {
    assert.equal(await status(app.walkerPort, '/markers.js'), 404);
    assert.equal(await status(app.walkerPort, '/..%2fmap%2fmain.js'), 404);
    assert.equal(await status(app.walkerPort, '/shared/..%2f..%2fserver%2fconfig.js'), 404);
    assert.equal(await status(app.mapPort, '/', { host: 'example.trycloudflare.com' }), 403);
    const outsider = new WebSocket(`ws://${local}/socket`, { origin: 'https://example.com' });
    await assert.rejects(new Promise((resolve, reject) => outsider.on('open', resolve).on('error', reject)));
  });

  await t.test('passes positions on', async () => {
    const map = new WebSocket(`ws://${local}/socket`, { origin: `http://${local}` });
    const arrived = waitFor(map, (m) => m.type === 'people' && m.people.length === 1);
    const walker = new WebSocket(`ws://localhost:${app.walkerPort}/socket`);
    await waitFor(walker, (m) => m.type === 'welcome');
    walker.send(JSON.stringify({
      type: 'position', id: 'p1', name: 'Sam', lat: 55.001, lon: -8.002, accuracy: 1.5, t: Date.now(), source: 'sim',
    }));
    const { people } = await arrived;
    assert.equal(people[0].name, 'Sam');
    assert.equal(people[0].lat, 55.001);
    assert.match(fs.readFileSync(app.logFile, 'utf8'), /"Sam",sim,55\.001,-8\.002,1\.5/);
  });
});
