// Turns the detectors' frame-by-frame reads into a steady picture of what is in
// view, and reports what has arrived and left. No camera or page code here.

const CONFIRM_FRAMES = 2;  // seen this many frames running before it counts
const MISSING_MS = 600;    // gone this long before it counts as removed
const FOLLOW = 0.5;        // position smoothing: 1 = none, smaller = smoother
const GRID_ACROSS = 320;   // matches the sampling grid in vision/colourStrips.js

export function readTagThings(tags, width) {
  return tags.map((tag) => ({
    key: "tag " + tag.id, kind: "tag", id: tag.id,
    x: tag.x, y: tag.y, size: tag.px / width, rot: tag.rot,
  }));
}

// One thing per learned colour: its biggest card gives the position and size.
export function readColourThings(strips, width, height) {
  const step = Math.max(2, Math.round(width / GRID_ACROSS));
  const found = new Map();
  for (const strip of strips ?? []) {
    const size = (strip.cells * step * step) / (width * height);
    const best = found.get(strip.colour);
    const count = (best?.count ?? 0) + 1;
    if (best && best.size >= size) {
      best.count = count;
      continue;
    }
    found.set(strip.colour, {
      key: "colour " + (strip.colour + 1), kind: "colour", id: strip.colour + 1,
      x: strip.centre[0], y: strip.centre[1], size, count,
    });
  }
  return [...found.values()];
}

export function createScene() {
  const things = new Map();  // key -> { thing, hits, seenAt, shown }

  return {
    // reads: this frame's things. Returns { things, appeared, left }.
    update(reads, now) {
      const appeared = [];
      const left = [];
      const seen = new Set();
      for (const read of reads) {
        seen.add(read.key);
        let entry = things.get(read.key);
        if (!entry) {
          entry = { thing: { ...read }, hits: 0, shown: false };
          things.set(read.key, entry);
        } else {
          const x = entry.thing.x + (read.x - entry.thing.x) * FOLLOW;
          const y = entry.thing.y + (read.y - entry.thing.y) * FOLLOW;
          entry.thing = { ...read, x, y };
        }
        entry.hits += 1;
        entry.seenAt = now;
        if (!entry.shown && entry.hits >= CONFIRM_FRAMES) {
          entry.shown = true;
          appeared.push(entry.thing);
        }
      }
      for (const [key, entry] of things) {
        if (seen.has(key)) continue;
        if (!entry.shown) things.delete(key);  // a one-frame misread
        else if (now - entry.seenAt > MISSING_MS) {
          things.delete(key);
          left.push(entry.thing);
        }
      }
      const shown = [...things.values()].filter((e) => e.shown).map((e) => e.thing);
      shown.sort((a, b) => a.kind.localeCompare(b.kind) || a.id - b.id);
      return { things: shown, appeared, left };
    },
    clear() {
      things.clear();
    },
  };
}

const round = (value, places) => Number(value.toFixed(places));

// The small JSON sent to a computer.
export function describe(things) {
  const tags = things.filter((t) => t.kind === "tag").map((t) => ({
    id: t.id, x: round(t.x, 3), y: round(t.y, 3), size: round(t.size, 3), rot: Math.round(t.rot),
  }));
  const colours = things.filter((t) => t.kind === "colour").map((t) => ({
    id: t.id, x: round(t.x, 3), y: round(t.y, 3), size: round(t.size, 3), count: t.count,
  }));
  return { tags, colours };
}

// Has anything arrived, left or moved enough since the description last sent?
export function changed(before, after, move) {
  if (!before) return true;
  for (const kind of ["tags", "colours"]) {
    if (before[kind].length !== after[kind].length) return true;
    for (let i = 0; i < after[kind].length; i++) {
      const a = before[kind][i];
      const b = after[kind][i];
      if (a.id !== b.id || a.count !== b.count) return true;
      if (Math.hypot(a.x - b.x, a.y - b.y) >= move) return true;
      const turn = Math.abs((((b.rot ?? 0) - (a.rot ?? 0)) % 360 + 540) % 360 - 180);
      if (turn >= 5) return true;
    }
  }
  return false;
}
