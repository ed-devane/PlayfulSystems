// What the camera's view does. Change this file to make your own version.
//
// A "thing" is a paper tag or a colour card in view:
//   { kind: "tag" or "colour",
//     id:    the tag's number, or the colour's number (1, 2, 3...),
//     x:     0 (left of the picture) to 1 (right),
//     y:     0 (top) to 1 (bottom),
//     size:  how big it looks (tags: width, colours: area), 0 to 1,
//     rot:   tags only, degrees of turn,
//     count: colours only, how many separate cards of this colour }
//
// The board understands "play 1", "tone 440 0.5" and "stop".

export const SETTINGS = {
  MOVE: 0.02,          // how far a thing must move (fraction of the picture) to count
  TONE_EVERY_MS: 100,  // fastest the tone is sent while moving
  STILL_MS: 500,       // no movement for this long means silence
};

// Something has come into view. Return a message for the board, or null.
export function onAppear(thing, { soundCount }) {
  // Tags pick a sound by number: tag 0 is sound 1, tag 1 is sound 2, and round again.
  if (thing.kind === "tag") return "play " + ((thing.id % soundCount) + 1);
  // Colour 1 plays sound 1, colour 2 plays sound 2, and round again.
  return "play " + (((thing.id - 1) % soundCount) + 1);
}

// Something has moved: left to right is low to high, higher up is louder.
export function toneFor(thing) {
  const pitch = 220 * Math.pow(4, thing.x);  // 220 to 880 Hz
  const level = 1 - thing.y;
  return "tone " + pitch.toFixed(0) + " " + level.toFixed(2);
}
