// Messages for the person using the app. Phones have no easy console,
// so everything is also listed under Settings > Log.

const history = [];

function record(text) {
  history.push(`${new Date().toLocaleTimeString()}  ${text}`);
  if (history.length > 200) history.shift();
  const box = document.getElementById('log');
  if (box) box.textContent = history.join('\n');
}

function show(text, isError) {
  const bar = document.getElementById('message');
  if (!bar) return;
  bar.textContent = text;
  bar.classList.toggle('error', isError);
  bar.hidden = false;
}

// For progress that changes every second: shown, but not kept in the log.
export const status = (text) => show(text, false);

export function info(text) {
  console.log('[recipe-slips]', text);
  record(text);
  show(text, false);
}

export function error(text, cause) {
  console.error('[recipe-slips]', text, cause ?? '');
  record(`ERROR: ${text}${cause ? ` (${cause.name}: ${cause.message})` : ''}`);
  show(text, true);
}

// Anything that goes wrong unexpectedly still shows up on screen.
export function catchUnexpectedErrors() {
  window.addEventListener('error', (e) => error(`Something went wrong: ${e.message}`, e.error));
  window.addEventListener('unhandledrejection', (e) => error('Something went wrong. See Settings > Log.', e.reason));
  document.getElementById('message').addEventListener('click', (e) => {
    e.currentTarget.hidden = true;
  });
}
