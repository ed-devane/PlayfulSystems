// Copied from Soniphorm Centipede (Ed Devane). See ../README.md.
// Reads ArUco tags (DICT_5X5_1000, the same dictionary the FilmScore sheets were
// printed with) from one RGBA frame. Pure JS, no DOM, so the same code runs in
// the laptop's worker, on the phone, and in a Node test.
//
// Each tag comes back as { id, x, y, rot, px, corners }: x and y are 0-1 across
// the frame, rot is degrees (-180..180, 0 = upright, measured along the tag's top
// edge like OpenCV's atan2 of corner 1 minus corner 0), px is the mean side
// length in frame pixels, and corners are the four corners in 0-1 frame units
// for drawing outlines.
import { AR } from '../vendor/js-aruco2/aruco.js';
import '../vendor/js-aruco2/aruco_5x5_1000.js';

export const MAX_TAG_ID = 399; // the sheets stop here; a higher id is a misread
// One bit of tolerance: tested against OpenCV-made tags, the dictionary's own
// default let misreads through (ids like 651 off a clean sheet), 0 lost real tags.
const MAX_HAMMING = 1;

export function createTagReader() {
  const detector = new AR.Detector({ dictionaryName: 'ARUCO_5X5_1000', maxHammingDistance: MAX_HAMMING });

  return function readTags(width, height, rgba) {
    const markers = detector.detectImage(width, height, rgba);
    const byId = new Map();
    for (const marker of markers) {
      if (marker.id > MAX_TAG_ID) continue;
      const c = marker.corners;
      let side = 0;
      for (let i = 0; i < 4; i++) {
        const a = c[i];
        const b = c[(i + 3) % 4];
        side += Math.hypot(a.x - b.x, a.y - b.y);
      }
      side /= 4;
      // The same tag can come back twice (an inner and outer contour): keep the bigger read.
      const existing = byId.get(marker.id);
      if (existing && existing.px >= side) continue;
      const cx = (c[0].x + c[1].x + c[2].x + c[3].x) / 4;
      const cy = (c[0].y + c[1].y + c[2].y + c[3].y) / 4;
      byId.set(marker.id, {
        id: marker.id,
        x: round(cx / width, 4),
        y: round(cy / height, 4),
        rot: round((Math.atan2(c[1].y - c[0].y, c[1].x - c[0].x) * 180) / Math.PI, 1),
        px: round(side, 1),
        corners: c.map((p) => [round(p.x / width, 4), round(p.y / height, 4)]),
      });
    }
    return [...byId.values()].sort((a, b) => a.id - b.id);
  };
}

// The 5x5 data cells for a tag, row by row, 1 = white. Used to draw the sheets.
let sheetDictionary = null; // building one takes about 0.1 s, so only once
export function tagBits(id) {
  sheetDictionary ??= new AR.Dictionary('ARUCO_5X5_1000');
  const code = sheetDictionary.codeList[id];
  if (code == null) throw new Error(`no tag ${id} in DICT_5X5_1000`);
  return Array.from({ length: 5 }, (_, y) => Array.from({ length: 5 }, (_, x) => code[y * 5 + x] === '1'));
}

function round(value, places) {
  const f = 10 ** places;
  return Math.round(value * f) / f;
}
