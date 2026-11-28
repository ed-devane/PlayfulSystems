// Sets up the two web addresses:
//   walker: phones load their page here and send positions.
//   map:    the map of everyone, answered only on this computer.

import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { log } from './log.js';
import { readPosition } from './messages.js';
import { createPeople } from './people.js';
import { createPositionLog } from './positionLog.js';
import { serveFolders } from './staticFiles.js';

const projectFolder = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const inProject = (...parts) => path.join(projectFolder, ...parts);

const LOCAL_NAMES = ['localhost', '127.0.0.1'];

const send = (socket, message) => socket.send(JSON.stringify(message));

function listen(server, port) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    // 127.0.0.1: nothing else on the network can connect. The tunnel runs on this computer.
    server.listen(port, '127.0.0.1', () => resolve(server.address().port));
  });
}

export async function startApp(config) {
  const people = createPeople(config);
  const positionLog = createPositionLog(path.resolve(projectFolder, config.logFolder));
  const welcome = {
    type: 'welcome',
    settings: {
      mapStart: config.mapStart,
      sendEveryMs: config.sendEveryMs,
      practiceAccuracyM: config.practiceAccuracyM,
      reconnectMs: config.reconnectMs,
      maxNameLength: config.maxNameLength,
    },
  };
  const shared = [
    ['/vendor/leaflet/', inProject('node_modules', 'leaflet', 'dist')],
    ['/shared/', inProject('public', 'shared')],
  ];

  // --- The walker address ---
  const walkerServer = http.createServer(serveFolders([...shared, ['/', inProject('public', 'walker')]]));
  const walkers = new WebSocketServer({ noServer: true, maxPayload: 1024 });
  walkerServer.on('upgrade', (request, socket, head) => {
    walkers.handleUpgrade(request, socket, head, (ws) => walkers.emit('connection', ws));
  });
  walkers.on('connection', (socket) => {
    let complained = false;
    const complain = (reason) => {
      if (!complained) log.warn(`Ignoring messages from a phone: ${reason}`);
      complained = true;
      send(socket, { type: 'error', message: reason });
    };
    socket.on('error', (error) => log.warn(`Phone connection problem: ${error.message}`));
    socket.on('message', (data) => {
      const { position, error } = readPosition(data.toString(), config.maxNameLength);
      if (error) return complain(error);
      const result = people.update(position);
      if (!result) return complain(`there are already ${config.maxPeople} people`);
      if (result.isNew) log.info(`${position.name} joined (${position.source})`);
      positionLog.write(position);
    });
    send(socket, welcome);
  });

  // --- The map address ---
  // The checks on "host" and "origin" stop other websites, or a tunnel, reading it.
  let mapPort = config.mapPort;
  const isLocalHost = (host = '') => LOCAL_NAMES.some((name) => host === `${name}:${mapPort}`);
  const mapFiles = serveFolders([...shared, ['/', inProject('public', 'map')]]);
  const mapServer = http.createServer((request, response) => {
    if (isLocalHost(request.headers.host)) return mapFiles(request, response);
    response.writeHead(403, { 'Content-Type': 'text/plain' }).end('Only available on the computer itself');
  });
  const maps = new WebSocketServer({ noServer: true, maxPayload: 1024 });
  mapServer.on('upgrade', (request, socket, head) => {
    const { host, origin } = request.headers;
    if (!isLocalHost(host) || origin !== `http://${host}`) {
      log.warn(`Refused a map connection from ${origin ?? 'an unknown page'}`);
      return socket.destroy();
    }
    maps.handleUpgrade(request, socket, head, (ws) => maps.emit('connection', ws));
  });
  maps.on('connection', (socket) => {
    socket.on('error', (error) => log.warn(`Map connection problem: ${error.message}`));
    send(socket, welcome);
    send(socket, { type: 'people', people: people.list() });
  });

  const walkerPort = await listen(walkerServer, config.walkerPort);
  mapPort = await listen(mapServer, config.mapPort);

  const refresh = setInterval(() => {
    const message = { type: 'people', people: people.list() };
    for (const socket of maps.clients) send(socket, message);
  }, config.mapRefreshMs);

  return {
    walkerPort,
    mapPort,
    logFile: positionLog.file,
    async close() {
      clearInterval(refresh);
      for (const socket of [...walkers.clients, ...maps.clients]) socket.terminate();
      await Promise.all(
        [walkerServer, mapServer].map((server) => new Promise((resolve) => server.close(resolve))),
      );
    },
  };
}
