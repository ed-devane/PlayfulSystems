// Everything you might want to change lives here.

// Starting values for the settings screen. Changes made in the app are saved on the phone.
export const DEFAULT_SETTINGS = {
  slipTitle: 'PLAYFUL SYSTEMS',
  slipFooter: 'Make something that can be done in an afternoon.',
  charsPerLine: 32,
  fakePrinter: false,
};

export const CHARS_PER_LINE_LIMITS = { min: 24, max: 48 };

// A column with fewer words than this gets a warning.
export const MIN_ITEMS_PER_COLUMN = 4;

// How a slip is drawn.
export const SLIP_STYLE = {
  widthDots: 384, // PeriPage A6 print width
  fontFamily: 'monospace',
  fontWeight: 'bold',
  lineSpacing: 1.35,
  paddingDots: 12, // blank space above and below
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
};
