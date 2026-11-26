// Copied from Soniphorm Centipede (Ed Devane). See ../README.md.
// Colour strips: plain coloured card, read by colour, no codes. Each learned
// colour is a sound; each strip of it is one stretch of time (its left edge is
// when, its length is how long). Pure: an RGBA frame in, strips out, so it runs
// in the tag reader's worker and in Node tests.
//
// A pixel counts as a colour when it's saturated enough (the white board, grey
// shadows, black tag squares and glare are all low saturation, so they're never
// a strip) and its hue is within `tolerance` degrees of a learned colour. Pixels
// are sampled on a grid (`step` frame pixels apart), joined into connected
// patches, and each patch big enough becomes a strip: its long axis from
// end to end, and its width across.

export const MAX_COLOURS = 8;
export const DEFAULT_TOLERANCE = 20; // degrees of hue
export const MIN_SATURATION = 0.22; // below this it's white, grey or black: never a strip
const MIN_VALUE = 0.15;
const SAT_RANGE = 0.45; // how far a pixel's saturation may sit from the learned colour's
const VALUE_RANGE = 0.6;
// Sampling grid: about 320 cells across whatever the frame size, so Fine costs no more than Fast.
const GRID_ACROSS = 320;
const MIN_CELLS = 12; // smaller patches are specks (a stray dot of colour, noise)
// Note line: a short black marker stroke running in from the middle of the
// card's left edge. Dark cells inside the card's outline (colour above and
// below them in the same column) are the line; its height is the card's note
// and the zero for both envelopes. Without one the card plays as before.
const DARK_VALUE = 0.4; // darker than this (and not a learned colour) can be marker
const LINE_MIN_COLUMNS = 2;
const PROFILE_POINTS = 48; // outline samples kept per card

export function rgbToHsv(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max / 255 };
}

const hueDistance = (a, b) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

// The average colour of a small square around (x, y) (0-1 across the frame), as a palette entry.
export function sampleColour(width, height, rgba, x, y, radius = 6) {
  const cx = Math.round(x * width);
  const cy = Math.round(y * height);
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let yy = Math.max(0, cy - radius); yy <= Math.min(height - 1, cy + radius); yy++) {
    for (let xx = Math.max(0, cx - radius); xx <= Math.min(width - 1, cx + radius); xx++) {
      const i = (yy * width + xx) * 4;
      r += rgba[i];
      g += rgba[i + 1];
      b += rgba[i + 2];
      n += 1;
    }
  }
  if (!n) return null;
  r = Math.round(r / n);
  g = Math.round(g / n);
  b = Math.round(b / n);
  return { rgb: [r, g, b], ...rgbToHsv(r, g, b) };
}

// Which palette colour (index) a pixel is, or -1.
export function classify(r, g, b, palette, tolerance = DEFAULT_TOLERANCE) {
  const { h, s, v } = rgbToHsv(r, g, b);
  if (s < MIN_SATURATION || v < MIN_VALUE) return -1;
  let best = -1;
  let bestScore = Infinity;
  for (let k = 0; k < palette.length; k++) {
    const p = palette[k];
    if (!p) continue;
    const tol = p.tol ?? tolerance; // each cards module brings its own tolerance
    const dh = hueDistance(h, p.h);
    const ds = Math.abs(s - p.s);
    const dv = Math.abs(v - p.v);
    if (dh > tol || ds > SAT_RANGE || dv > VALUE_RANGE) continue;
    const score = dh / tol + ds / SAT_RANGE + dv / VALUE_RANGE;
    if (score < bestScore) {
      best = k;
      bestScore = score;
    }
  }
  return best;
}

// Strips in one frame: [{ colour, a: [x, y], b: [x, y], centre: [x, y], corners, width, cells }],
// a and b the two ends of the long axis, corners the four corners of the card's
// outline, all 0-1 across the frame; width (across the long axis) in frame pixels.
// Time comes from how far the corners span left to right, not from the long
// axis: a short card standing upright still covers its own width of time.
export function findStrips(width, height, rgba, palette, { tolerance = DEFAULT_TOLERANCE, step = null, minCells = MIN_CELLS } = {}) {
  if (!palette?.length) return [];
  step ??= Math.max(2, Math.round(width / GRID_ACROSS));
  const gw = Math.floor(width / step);
  const gh = Math.floor(height / step);
  const cls = new Int8Array(gw * gh);
  const dark = new Uint8Array(gw * gh);
  // Marker ink can photograph as a very dark shade of the card (dark green on
  // green), so anything well below the darkest learned colour is ink, not card.
  const darkLimit = 255 * Math.min(DARK_VALUE, 0.6 * Math.min(...palette.map((p) => (p ? p.v : 1))));
  for (let gy = 0; gy < gh; gy++) {
    const py = gy * step + (step >> 1);
    for (let gx = 0; gx < gw; gx++) {
      const i = (py * width + gx * step + (step >> 1)) * 4;
      if (Math.max(rgba[i], rgba[i + 1], rgba[i + 2]) < darkLimit) {
        cls[gy * gw + gx] = -1;
        dark[gy * gw + gx] = 1;
        continue;
      }
      cls[gy * gw + gx] = classify(rgba[i], rgba[i + 1], rgba[i + 2], palette, tolerance);
    }
  }
  const seen = new Uint8Array(gw * gh);
  const stack = new Int32Array(gw * gh);
  const cells = new Int32Array(gw * gh);
  const strips = [];
  for (let start = 0; start < cls.length; start++) {
    const colour = cls[start];
    if (colour < 0 || seen[start]) continue;
    // Flood fill this patch (4-neighbours).
    let top = 0;
    let count = 0;
    stack[top++] = start;
    seen[start] = 1;
    let sx = 0;
    let sy = 0;
    while (top > 0) {
      const c = stack[--top];
      cells[count++] = c;
      const x = c % gw;
      const y = (c - x) / gw;
      sx += x;
      sy += y;
      if (x > 0 && !seen[c - 1] && cls[c - 1] === colour) (seen[c - 1] = 1), (stack[top++] = c - 1);
      if (x < gw - 1 && !seen[c + 1] && cls[c + 1] === colour) (seen[c + 1] = 1), (stack[top++] = c + 1);
      if (y > 0 && !seen[c - gw] && cls[c - gw] === colour) (seen[c - gw] = 1), (stack[top++] = c - gw);
      if (y < gh - 1 && !seen[c + gw] && cls[c + gw] === colour) (seen[c + gw] = 1), (stack[top++] = c + gw);
    }
    if (count < minCells) continue;
    // Long axis from the patch's spread (principal axis), then its extent along and across it.
    const mx = sx / count;
    const my = sy / count;
    let xx = 0;
    let yy = 0;
    let xy = 0;
    for (let k = 0; k < count; k++) {
      const x = cells[k] % gw;
      const y = (cells[k] - x) / gw;
      xx += (x - mx) ** 2;
      yy += (y - my) ** 2;
      xy += (x - mx) * (y - my);
    }
    const angle = 0.5 * Math.atan2(2 * xy, xx - yy);
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);
    let lo = Infinity;
    let hi = -Infinity;
    let across = 0;
    for (let k = 0; k < count; k++) {
      const x = cells[k] % gw;
      const y = (cells[k] - x) / gw;
      const along = (x - mx) * ux + (y - my) * uy;
      if (along < lo) lo = along;
      if (along > hi) hi = along;
      across = Math.max(across, Math.abs(-(x - mx) * uy + (y - my) * ux));
    }
    // Cell indices to frame pixels (cell centres), half a cell added at each end.
    const toFrame = (gx, gy) => [((gx + 0.5) * step) / width, ((gy + 0.5) * step) / height];
    const a = toFrame(mx + (lo - 0.5) * ux, my + (lo - 0.5) * uy);
    const b = toFrame(mx + (hi + 0.5) * ux, my + (hi + 0.5) * uy);
    const half = across + 0.5;
    const corners = [
      [lo - 0.5, -half],
      [hi + 0.5, -half],
      [hi + 0.5, half],
      [lo - 0.5, half],
    ].map(([al, ac]) => toFrame(mx + al * ux - ac * uy, my + al * uy + ac * ux).map((v) => round(v, 4)));
    const shape = cardShape(cells, count, gw, dark, step, width, height);
    strips.push({
      colour,
      ...shape,
      a: a.map((v) => round(v, 4)),
      b: b.map((v) => round(v, 4)),
      centre: toFrame(mx, my).map((v) => round(v, 4)),
      corners,
      width: round((across * 2 + 1) * step, 1),
      cells: count,
    });
  }
  return strips;
}

// A card's note line and outline. Per grid column: the card's top and bottom
// edge; dark cells between them are the marker line (a hole, or a notch in from
// the left edge, so the card stays one patch). Returns {} without a line, else
// { line: { y, x0, x1 }, profile: [[x, top, bottom], ...] }, all frame 0-1.
function cardShape(cells, count, gw, dark, step, width, height) {
  let minX = Infinity;
  let maxX = -Infinity;
  for (let k = 0; k < count; k++) {
    const x = cells[k] % gw;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
  }
  const cols = maxX - minX + 1;
  const top = new Int32Array(cols).fill(-1);
  const bot = new Int32Array(cols).fill(-1);
  for (let k = 0; k < count; k++) {
    const x = cells[k] % gw;
    const y = (cells[k] - x) / gw;
    const i = x - minX;
    if (top[i] < 0 || y < top[i]) top[i] = y;
    if (y > bot[i]) bot[i] = y;
  }
  // Dark cells inside the outline, column by column.
  const ys = [];
  let lx0 = Infinity;
  let lx1 = -Infinity;
  let lineCols = 0;
  for (let i = 0; i < cols; i++) {
    if (top[i] < 0) continue;
    const x = minX + i;
    let found = false;
    for (let y = top[i] + 1; y < bot[i]; y++) {
      if (!dark[y * gw + x]) continue;
      ys.push(y);
      found = true;
    }
    if (found) {
      lineCols += 1;
      lx0 = Math.min(lx0, x);
      lx1 = Math.max(lx1, x);
    }
  }
  if (lineCols < LINE_MIN_COLUMNS) return {};
  ys.sort((p, q) => p - q);
  const lineY = ys[ys.length >> 1];
  // A thin stroke, not a tag or a shadow: most dark cells close to the median.
  const near = ys.filter((y) => Math.abs(y - lineY) <= 2).length;
  if (near < ys.length * 0.7) return {};
  // Outline, lightly smoothed (a rough scissor edge, a cell of camera noise).
  const raw = [];
  for (let i = 0; i < cols; i++) if (top[i] >= 0) raw.push([minX + i, top[i], bot[i]]);
  const med3 = (j, f) => [raw[Math.max(0, j - 1)][f], raw[j][f], raw[Math.min(raw.length - 1, j + 1)][f]].sort((p, q) => p - q)[1];
  const every = Math.max(1, Math.ceil(raw.length / PROFILE_POINTS));
  const profile = [];
  for (let j = 0; j < raw.length; j += every) {
    profile.push([
      round(((raw[j][0] + 0.5) * step) / width, 4),
      round((med3(j, 1) * step) / height, 4), // top edge of the top cell
      round(((med3(j, 2) + 1) * step) / height, 4), // bottom edge of the bottom cell
    ]);
  }
  return {
    line: { y: round(((lineY + 0.5) * step) / height, 4), x0: round((lx0 * step) / width, 4), x1: round(((lx1 + 1) * step) / width, 4) },
    profile,
  };
}

// A card's envelopes from its outline, on the sheet: [[x, a, b], ...] with x
// along the sheet (0-1) and a / b how far the card reaches above / below its
// line over halfMm (1 = a full uncut half). place(x, y) maps a frame point to
// the sheet ({ x, y }, y down, 0-1); sheetMm is the sheet's height in mm.
// Without a sheet (sheetMm null) both halves are measured against the card's
// own tallest reach.
export function envelopeFromShape(shape, place, sheetMm, halfMm) {
  if (!shape?.line || !shape.profile?.length) return null;
  const pts = shape.profile.map(([x, t, b]) => {
    const pt = place(x, t);
    const pl = place(x, shape.line.y);
    const pb = place(x, b);
    return [pl.x, Math.max(0, pl.y - pt.y), Math.max(0, pb.y - pl.y)];
  });
  const scale = sheetMm && halfMm > 0 ? sheetMm / halfMm : 1 / Math.max(1e-6, ...pts.map((p) => Math.max(p[1], p[2])));
  const clamp = (v) => Math.min(1, Math.max(0, v));
  return pts.map(([x, a, b]) => [round(x, 4), round(clamp(a * scale), 3), round(clamp(b * scale), 3)]).sort((p, q) => p[0] - q[0]);
}

// The envelope values ([top, bottom]) at sheet x, straight lines between outline samples.
export function envelopeAt(env, x) {
  if (!env?.length) return null;
  if (x <= env[0][0]) return [env[0][1], env[0][2]];
  for (let i = 1; i < env.length; i++) {
    if (x <= env[i][0]) {
      const [x0, a0, b0] = env[i - 1];
      const [x1, a1, b1] = env[i];
      const t = (x - x0) / Math.max(1e-9, x1 - x0);
      return [a0 + (a1 - a0) * t, b0 + (b1 - b0) * t];
    }
  }
  const last = env[env.length - 1];
  return [last[1], last[2]];
}

// Strips on the sheet ({ colour, x0, x1, y, env? }, 0-1) to what plays: per colour,
// the stretches of time it sounds. Overlapping strips of one colour are one
// stretch (legato), and so are strips with a gap smaller than `mergeGap` (a
// glare spot or a tag splitting one card). Each stretch keeps its pieces, so
// the height (the note) changes as the playhead reaches the next card: see
// heightAt. y is the longest piece's.
export function stretchesByColour(strips, colourCount, mergeGap = 0.01) {
  const out = Array.from({ length: colourCount }, () => []);
  const byColour = Array.from({ length: colourCount }, () => []);
  for (const s of strips) if (s.colour >= 0 && s.colour < colourCount) byColour[s.colour].push(s);
  byColour.forEach((list, c) => {
    list.sort((p, q) => p.x0 - q.x0);
    for (const s of list) {
      const last = out[c][out[c].length - 1];
      if (last && s.x0 <= last.x1 + mergeGap) {
        if (s.x1 - s.x0 > last.longest) {
          last.longest = s.x1 - s.x0;
          last.y = s.y;
        }
        last.x1 = Math.max(last.x1, s.x1);
        last.pieces.push({ x0: s.x0, x1: s.x1, y: s.y, env: s.env ?? null });
      } else {
        out[c].push({ x0: s.x0, x1: s.x1, y: s.y, longest: s.x1 - s.x0, pieces: [{ x0: s.x0, x1: s.x1, y: s.y, env: s.env ?? null }] });
      }
    }
  });
  return out.map((list) => list.map(({ x0, x1, y, pieces }) => ({ x0, x1, y, pieces })));
}

// The height playing at `phase` inside a stretch: the card most recently
// reached (the latest-starting piece the playhead has got to), so a melodic
// line steps to each new card's note as the playhead arrives at it.
function pieceAt(stretch, phase) {
  let best = null;
  for (const p of stretch.pieces ?? []) {
    if (p.x0 <= phase && (!best || p.x0 > best.x0)) best = p;
  }
  return best;
}

export function heightAt(stretch, phase) {
  return (pieceAt(stretch, phase) ?? stretch).y;
}

// The two envelopes ([top, bottom], 0-1) of the card being played at `phase`.
// A card without a note line is flat full ([1, 1]), as before envelopes existed.
export function envelopesAt(stretch, phase) {
  const p = pieceAt(stretch, phase) ?? stretch.pieces?.[0];
  return envelopeAt(p?.env, phase) ?? [1, 1];
}

// Notes: a height (0-1) onto a scale, as a MIDI note number.
export const SCALES = {
  pentatonic: [0, 2, 4, 7, 9],
  minorPentatonic: [0, 3, 5, 7, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

// The scale's notes from `low` up through `octaves` octaves; the one nearest
// `height` (0 = lowest, 1 = highest), evenly spaced up the arrange area.
// scale 'free': no snapping, the height glides continuously (microtonal).
// octaves can be fractional: 0.25 = a minor third from bottom to top.
export function noteFromHeight(height, { scale = 'pentatonic', root = 0, low = 48, octaves = 2 } = {}) {
  const h0 = Math.min(1, Math.max(0, height));
  if (scale === 'free') return low + h0 * 12 * octaves;
  const degrees = SCALES[scale] ?? SCALES.pentatonic;
  const notes = [];
  for (let n = low; n <= low + 12 * octaves; n++) {
    if (degrees.includes((((n - root) % 12) + 12) % 12)) notes.push(n);
  }
  if (!notes.length) return low;
  const h = Math.min(1, Math.max(0, height));
  return notes[Math.round(h * (notes.length - 1))];
}

// Cards followed from frame to frame, so a noisy read doesn't keep the board
// from ever settling: a small card, or a colour near the edge of its
// tolerance, can blink out for a frame, and a thin note line can be missed in
// one frame and found in the next. Each card here ({ colour, x0, x1, y, env },
// on the sheet) is matched to the nearest one of its colour last time. A card
// shows once it's been seen in `confirmFrames` frames, and stays for
// `missingMs` after it was last seen. A card whose line was missed this frame
// keeps its last line's note and envelopes. Positions are lightly averaged.
export function createCardTracker({ missingMs = 450, confirmFrames = 2, matchDistance = 0.04, follow = 0.5 } = {}) {
  let tracks = [];
  const centre = (c) => [(c.x0 + c.x1) / 2, c.y];
  return {
    update(cards, now) {
      const free = new Set(tracks.keys());
      for (const card of cards) {
        const [cx, cy] = centre(card);
        let best = -1;
        let bestD = matchDistance;
        for (const i of free) {
          const t = tracks[i];
          if (t.colour !== card.colour) continue;
          const [tx, ty] = centre(t);
          const d = Math.hypot(cx - tx, cy - ty);
          if (d < bestD) {
            best = i;
            bestD = d;
          }
        }
        if (best < 0) {
          tracks.push({ ...card, hits: 1, seenAt: now });
          continue;
        }
        free.delete(best);
        const t = tracks[best];
        const mix = (a, b) => a + (b - a) * follow;
        t.x0 = mix(t.x0, card.x0);
        t.x1 = mix(t.x1, card.x1);
        // The line is the note: a frame that missed it keeps the last one's height and envelopes.
        if (card.env || !t.env) {
          t.y = t.env && card.env ? mix(t.y, card.y) : card.y;
          t.env = card.env ?? null;
        }
        t.hits += 1;
        t.seenAt = now;
      }
      tracks = tracks.filter((t) => now - t.seenAt <= missingMs);
      return this.cards();
    },
    cards() {
      return tracks.filter((t) => t.hits >= confirmFrames).map(({ colour, x0, x1, y, env }) => ({ colour, x0, x1, y, env }));
    },
    clear() {
      tracks = [];
    },
  };
}

// The board is read when it's still: a reading is used once it has held for
// `stillMs` with nothing busy (a hand over the board: skin reads as orange-red,
// and an arm covers strips). Until then the last settled arrangement stays.
// Each colour settles on its own: a colour that flickers (a learned yellow
// catching warm lamplight on the paper, say) never holds back one that's still.
export function createStripSettler({ stillMs = 500, tolerance = 0.012 } = {}) {
  let candidates = []; // per colour: this frame's layout, waiting to hold still
  let since = [];
  let settled = null; // per colour: the layout playing now

  function sameList(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      const p = a[i];
      const q = b[i];
      if (Math.abs(p.x0 - q.x0) > tolerance || Math.abs(p.x1 - q.x1) > tolerance || Math.abs(p.y - q.y) > tolerance * 2) return false;
      // Moving one card up or down inside a legato run is a change too.
      const pp = p.pieces ?? [];
      const qp = q.pieces ?? [];
      if (pp.length !== qp.length) return false;
      for (let k = 0; k < pp.length; k++) {
        if (Math.abs(pp[k].x0 - qp[k].x0) > tolerance || Math.abs(pp[k].y - qp[k].y) > tolerance * 2) return false;
        if (!sameEnvelope(pp[k], qp[k])) return false;
      }
    }
    return true;
  }

  return {
    // stretches: stretchesByColour's output for this frame; busy: a hand is over the board.
    update(stretches, now, busy) {
      if (busy) {
        candidates = [];
        return settled;
      }
      const next = stretches.map((_, c) => settled?.[c] ?? null);
      let any = !!settled;
      for (let c = 0; c < stretches.length; c++) {
        if (!sameList(stretches[c], candidates[c])) {
          candidates[c] = stretches[c];
          since[c] = now;
        } else if (now - since[c] >= stillMs) {
          next[c] = candidates[c];
          any = true;
        }
      }
      candidates.length = stretches.length;
      if (any) settled = next.map((list) => list ?? []);
      return settled;
    },
    settled() {
      return settled;
    },
    // Colour c (or every colour, with no c) is playing what the camera sees now.
    stable(c) {
      const one = (k) => !!candidates[k] && sameList(candidates[k], settled?.[k]);
      if (c != null) return one(c);
      return candidates.length > 0 && candidates.every((_, k) => one(k));
    },
    clear() {
      candidates = [];
      since = [];
      settled = null;
    },
  };
}

// Re-cutting a card is a change; a cell of camera jitter on its outline isn't.
function sameEnvelope(p, q) {
  if (!p.env !== !q.env) return false;
  if (!p.env) return true;
  const n = 12;
  let diff = 0;
  for (let i = 0; i < n; i++) {
    const x = p.x0 + ((p.x1 - p.x0) * (i + 0.5)) / n;
    const a = envelopeAt(p.env, x);
    const b = envelopeAt(q.env, x);
    diff += Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
  }
  return diff / (2 * n) < 0.08;
}

function round(value, places) {
  const f = 10 ** places;
  return Math.round(value * f) / f;
}
