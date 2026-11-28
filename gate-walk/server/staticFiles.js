// Sends page files to the browser, only from the folders listed.

import fs from 'node:fs';
import path from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
};

// mounts: [[address start, folder], ...]. The first match wins, so "/" goes last.
export function serveFolders(mounts) {
  return (request, response) => {
    const notFound = () => response.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');

    let address;
    try {
      address = decodeURIComponent(request.url.split('?')[0]);
    } catch {
      return notFound();
    }
    const mount = mounts.find(([start]) => address.startsWith(start));
    if (!mount) return notFound();

    const [start, folder] = mount;
    const root = path.resolve(folder);
    const file = path.resolve(root, `./${address.slice(start.length) || 'index.html'}`);
    if (!file.startsWith(root + path.sep)) return notFound(); // no climbing out of the folder

    fs.readFile(file, (error, content) => {
      if (error) return notFound();
      response.writeHead(200, {
        'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream',
        'Cache-Control': 'no-store', // always load the current files
      });
      response.end(content);
    });
  };
}
