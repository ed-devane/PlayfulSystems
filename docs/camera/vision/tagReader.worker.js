// Adapted from Soniphorm Centipede (Ed Devane). See ../README.md.
// Reads tags and colour cards off the main thread, so a slow frame never stalls
// the page. One frame in, one list of each out.
import { createTagReader } from './tagReader.js';
import { findStrips } from './colourStrips.js';

const readTags = createTagReader();

self.onmessage = (event) => {
  const { id, width, height, buffer, colours } = event.data;
  const started = performance.now();
  const rgba = new Uint8ClampedArray(buffer);
  // Colour cards first: the tag reader works on its own grey copy, but don't rely on that.
  const strips = colours?.palette?.length ? findStrips(width, height, rgba, colours.palette, { tolerance: colours.tolerance }) : null;
  const tags = readTags(width, height, rgba);
  self.postMessage({ id, tags, strips, width, height, ms: performance.now() - started });
};
