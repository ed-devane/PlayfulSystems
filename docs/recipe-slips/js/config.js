// Everything you might want to change lives here.

// Starting values for the settings screen. Changes made in the app are saved on the phone.
export const DEFAULT_SETTINGS = {
  apiKey: '', // never put a key here: type it into the app, which keeps it on the phone
  model: 'anthropic/claude-opus-5.5', // any OpenRouter model that can look at pictures
  headingColour: 'pink',
  itemColour: 'green',
  slipTitle: 'PLAYFUL SYSTEMS',
  slipFooter: 'Make something that can be done in an afternoon.',
  fakePrinter: false,
};

// The published app, used for the QR code. The ?v= part makes a phone fetch the page afresh.
export const APP_URL = 'https://ed-devane.github.io/PlayfulSystems/recipe-slips/?v=2';

// Reading the photo.
export const VISION = {
  url: 'https://openrouter.ai/api/v1/chat/completions',
  maxTokens: 16000, // room for the model's thinking as well as its answer
  timeoutMs: 120000,
};

export const PHOTO = {
  maxEdgePixels: 2576, // longest side of the picture that gets sent
  jpegQuality: 0.9,
};

// A column with fewer words than this gets a warning.
export const MIN_ITEMS_PER_COLUMN = 4;

// How a slip is drawn. It is read lengthways. Sizes are in printer dots (8 per mm).
export const SLIP_STYLE = {
  widthDots: 384, // PeriPage A6 print width: the height of the slip as you read it
  fontFamily: 'monospace',
  fontWeight: 'bold',
  lineSpacing: 1.3,

  // Lettering sizes. A block that doesn't fit across the paper shrinks to fit.
  namePx: 68,
  wordPx: 46,
  titlePx: 30, // title, partner and footer

  // Longest line, in characters, before wrapping.
  nameChars: 14,
  textChars: 22,
  wordChars: 30,

  marginDots: 8, // blank edge along the long sides
  endDots: 16, // blank space at each end
  gapDots: 48, // between the two blocks, with a divider line
};

// PeriPage timings. The printer has a small buffer, so rows are sent slowly.
export const PRINTER = {
  baudRate: 115200,
  rowsPerWrite: 8,
  rowDelayMs: 10,
  feedAfterSlipDots: 96, // about 12 mm, enough to tear the slip off
  pauseAfterSlipMs: 800,
};

// Names under which things are saved on the phone.
export const STORAGE_KEYS = {
  table: 'recipeSlips.table',
  settings: 'recipeSlips.settings',
  names: 'recipeSlips.names',
  draw: 'recipeSlips.draw',
};
