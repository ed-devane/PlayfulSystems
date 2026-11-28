// Start here:  node server/main.js

import { startApp } from './app.js';
import config from './config.js';
import { log } from './log.js';

try {
  const app = await startApp(config);
  log.info('Gate Walk is running. Press Ctrl+C to stop.');
  log.info(`Practice walker:  http://localhost:${app.walkerPort}/?sim=1`);
  log.info(`Map of everyone:  http://localhost:${app.mapPort}`);
  log.info(`Saving positions to ${app.logFile}`);
} catch (error) {
  if (error.code === 'EADDRINUSE') {
    log.error(`Port ${error.port} is already in use. Is Gate Walk already running in another window?`);
  } else {
    log.error(`Could not start: ${error.stack ?? error}`);
  }
  process.exit(1);
}
